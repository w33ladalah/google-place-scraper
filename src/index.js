//#region Imports
// Library ----------------------------------------------------------------------------------
import electron from 'electron';
import { Logger } from './lib/logger';
import { FilePaths } from './lib/file-paths.js';
import { PuppeteerWrapper } from './lib/puppeteer-wrapper';
import $ from 'jquery';
import { join } from 'path';
import JSONdb from 'simple-json-db';

//#endregion

//#region Setup - Dependency Injection-----------------------------------------------
const EXTENSIONS = "xls|xlsx|xlsm|xlsb|xml|csv|txt|dif|sylk|slk|prn|ods|fods|htm|html".split("|");
const _logger = new Logger();
const _filePaths = new FilePaths(_logger, "gmap-scrapper");
const _ipcRenderer = electron.ipcRenderer;
const _puppeteerWrapper = new PuppeteerWrapper(_logger, _filePaths,
	{ headless: false, width: 800, height: 600 });

// Use JSON file for storage
const file = join(__dirname, '../data/db.json');
const db = new JSONdb(file);
//#endregion

//#region Main ---------------------------------------------------------------------

async function main() {
	$('#searchBtn').on('click', async (e) => {
		e.preventDefault();

		const searchQuery = $('input#searchBusiness').val();
		const searchLimit = parseInt($('select#searchLimit').val());

		$('input#searchBusiness').attr('disabled', 'disabled');
		$('input#searchLimit').attr('disabled', 'disabled');

		await GMapScrapper(searchQuery, searchLimit);
	});

	$('#stopBtn').on('click', async (e) => {
		e.preventDefault();

		await _puppeteerWrapper.cleanup();

		$('#searchBtn').removeAttr('disabled');
		$(e.target).attr('disabled', 'disabled');
		$('#restartBtn').attr('disabled', 'disabled');

		$('input#searchBusiness').removeAttr('disabled');
		$('input#searchLimit').removeAttr('disabled');
	});

	$('#restartBtn').on('click', async (e) => {
		e.preventDefault();

		await _puppeteerWrapper.cleanup();

		const searchQuery = $('input#searchBusiness').val();
		const searchLimit = parseInt($('select#searchLimit').val());

		await GMapScrapper(searchQuery, searchLimit);
	});

	$('#exportBtn').on('click', async (e) => {
		_ipcRenderer.send('export-to-xlsx');
	});
}

async function getPageData(url, page) {
	await page.goto(url);

	// await loadWebViewPage(url);

	//Shop Name
	await page.waitForSelector(".x3AX1-LfntMc-header-title-title span");
	const shopName = await page.$eval(
		".x3AX1-LfntMc-header-title-title span",
		(name) => name.textContent
	);

	await page.waitForSelector(".x3AX1-LfntMc-header-title-ij8cu-haAclf");
	const reviewRating = await page.$eval(
		".x3AX1-LfntMc-header-title-ij8cu-haAclf span > span > span",
		(rating) => rating.textContent
	);

	await page.waitForSelector(".x3AX1-LfntMc-header-title-ij8cu-haAclf");
	const reviewCount = await page.$eval(
		".x3AX1-LfntMc-header-title-ij8cu-haAclf span button.widget-pane-link",
		(review) => review.textContent
	);

	//Shop Address
	await page.waitForSelector(".QSFF4-text.gm2-body-2:nth-child(1)");
	let address = await page.$$eval(
		"#pane > div > div > div > div > div > div > button > div > div > div",
		(divs) =>
			Array.from(divs)
				.map((div) => div.innerText)
				.find((address) => address)
	);

	if (address === undefined) {
		address = await page.$$eval(
			"#pane > div > div > div > div > div > div > button > div > div > div",
			(divs) => divs[1]
		);
	}

	//Website
	try {
		await page.waitForSelector(".HY5zDd", { timeout: 3 });
	} catch (ex) {
		console.log('No element found.');
	}

	const website = await page.$$eval(
		"#pane > div > div > div > div > div > div > button > div > div > div",
		(divs) =>
			Array.from(divs)
				.map((div) => div.innerText)
				.find((link) =>
					/^((https?|ftp|smtp):\/\/)?(www.)?[a-z0-9]+(\.[a-z]{2,}){1,3}(#?\/?[a-zA-Z0-9#]+)*\/?(\?[a-zA-Z0-9-_]+=[a-zA-Z0-9-%]+&?)?$/.test(
						link
					)
				)
	);

	const phone = await page.$$eval(
		// "#pane > div > div.widget-pane-content.cYB2Ge-oHo7ed > div > div > div:nth-child(9) > div:nth-child(2) > button > div.AeaXub > div.rogA2c > div.QSFF4-text.gm2-body-2",
		'#pane > div > div.widget-pane-content.cYB2Ge-oHo7ed > div > div > div:nth-child(9) > div > button[data-item-id^="phone:tel:"] div.QSFF4-text.gm2-body-2',
		(divs) =>
			Array.from(divs)
				.map((div) => div.innerText)
				.find((phone) => phone)
	);

	const latLong = await getLatLong(url);

	let returnObj = {
		shop: shopName.trim(),
		rating: reviewRating === undefined ? '' : reviewRating.trim(),
		reviews: reviewCount === undefined ? '' : reviewCount.trim(),
		address: address === undefined ? '' : address.trim(),
		website: website === undefined ? '' : website.trim(),
		phone: phone === undefined ? '' : phone.trim().replace(/\-/g, ''),
		latitude: latLong[0],
		longitude: latLong[1],
	};

	return returnObj;
	//await browser.close();
}

//Get Links
async function getLinks(page) {
	// Scrolling to bottom of page
	let newScrollHeight = 0;
	let scrollHeight = 1000;
	let divSelector = "#pane > div > div > div > div > div:nth-child(4) > div";

	while (true) {
		await page.waitForSelector(divSelector);

		await page.evaluate(
			(scrollHeight, divSelector) =>
				document.querySelector(divSelector).scrollTo(0, scrollHeight),
			scrollHeight,
			divSelector
		);

		await page.waitForTimeout(500);

		newScrollHeight = await page.$eval(
			divSelector,
			(div) => div.scrollHeight
		);

		if (scrollHeight === newScrollHeight) {
			break;
		} else {
			scrollHeight = newScrollHeight;
		}
	}

	// Get results
	const searchResults = await page.evaluate(() =>
		Array.from(document.querySelectorAll("a"))
			.map((el) => el.href)
			.filter(
				(link) =>
					link.match(/https:\/\/www.google.com\/maps\//g, link) &&
					!link.match(/\=https:\/\/www.google.com\/maps\//g, link)
			)
	);

	return searchResults;
}

async function getLatLong(url) {
	const latLongStartIndex = url.indexOf('!3d-') + 4;
	const latLongEndIndex = url.indexOf('?');
	const latLongData = url.substring(latLongStartIndex, latLongEndIndex).replace('!4d', ':');

	return latLongData.split(":");
}

async function loadWebViewPage(url) {
	const webview = document.getElementById('gmapWv');
	await webview.loadURL(url);
	// webview.removeEventListener('dom-ready', loadWebViewPage);
	// webview.addEventListener('dom-ready', loadWebViewPage);
}

async function GMapScrapper(searchQuery = "toko bunga di bogor", maxLinks = 100) {
	console.log('Start scrapping data.');

	$('#searchBtn').attr('disabled', 'disabled');
	$('#stopBtn').removeAttr('disabled');
	$('#restartBtn').removeAttr('disabled');
	$('#statusText span#statusTxt').removeClass('text-success').addClass('text-danger').text('Start scraping...');

	const page = await _puppeteerWrapper.newPage();

	const gmapInitUrl = "https://www.google.com/maps/?q=" + searchQuery;

	await loadWebViewPage(gmapInitUrl);

	await page.goto(gmapInitUrl);
	await page.waitForNavigation({ waitUntil: "domcontentloaded" });
	await page.waitForSelector('body');

	let allLinks = [];
	let linkCount = 0;

	while (
		!(await page.$$eval(
			"#pane > div > div > div > div > div > div > div",
			(elements) =>
				Array.from(elements).some(
					(el) => (el.innerText === "Tidak ditemukan hasil" || el.innerText === "No results found")
				)
		))
	) {
		if (maxLinks !== 0 && linkCount > maxLinks) break;

		allLinks.push(...(await getLinks(page)));

		await page.$$eval("button", (elements) => {
			return Array.from(elements)
				.find((el) => (el.getAttribute("aria-label") === "Halaman berikutnya" || el.getAttribute("aria-label") === "Next page"))
				.click()
		});

		await page.waitForNavigation({ waitUntil: "load" });

		linkCount = allLinks.length;

		$('#statusText span#statusTxt').removeClass('text-danger').addClass('text-warning').text('Gathering links...');
		$('#resultCountText').text(linkCount > maxLinks ? maxLinks : linkCount);
	}

	const scrapedData = [];

	$('#resultsTable tbody').html('<tr><td class="text-center" colspan="9"><p>Data sedang diproses...</p></td></tr>');

	let no = 1;
	for (let link of allLinks) {
		if(maxLinks !== 0 && no > maxLinks) break;

		$('#statusText span#statusTxt').removeClass('text-warning').addClass('text-success').text('Processing "'+link+'"');

		const data = await getPageData(link, page);

		if (no === 1) $('#resultsTable tbody').empty();

		$('#resultsTable tbody').append(`
			<tr>
				<th scope="row">${no}</th>
				<td>${data.shop}</td>
				<td>${data.address}</td>
				<td>${data.phone}</td>
				<td>${data.website}</td>
				<td>${data.rating}</td>
				<td>${data.reviews}</td>
				<td>${data.latitude}</td>
				<td>${data.longitude}</td>
			</tr>
		`);
		scrapedData.push(data);
		no++;
	}

	db.set('links', allLinks);
	db.set('businesses', scrapedData);
	db.sync();

	$('#searchBtn').removeAttr('disabled');
	$('#stopBtn').attr('disabled', 'disabled');
	$('#restartBtn').attr('disabled', 'disabled');

	$('input#searchBusiness').removeAttr('disabled');
	$('input#searchLimit').removeAttr('disabled');

	await _puppeteerWrapper.cleanup();

	$('#statusText span#statusTxt').removeClass('text-danger').addClass('text-success').text('Done!');
}

(async () => {
	try {
		// const chromeSet = await _puppeteerWrapper.setup();
		// if (!chromeSet) {
		// 	return;
		// }

		await main();


	} catch (e) {
		_logger.logError('Thrown error:');
		_logger.logError(e);
	} finally {
		await _puppeteerWrapper.cleanup();
	}

	_logger.logInfo('Done. Close window to exit');

	await _logger.exportLogs(_filePaths.logsPath());
})();

//#endregion
