'use strict';

var _electron = require('electron');

var _electron2 = _interopRequireDefault(_electron);

var _logger2 = require('./lib/logger');

var _filePaths2 = require('./lib/file-paths.js');

var _puppeteerWrapper2 = require('./lib/puppeteer-wrapper');

var _config = require('./config');

var _jquery = require('jquery');

var _jquery2 = _interopRequireDefault(_jquery);

var _simpleJsonDb = require('simple-json-db');

var _simpleJsonDb2 = _interopRequireDefault(_simpleJsonDb);

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

var _delay = require('delay');

var _delay2 = _interopRequireDefault(_delay);

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _md = require('md5');

var _md2 = _interopRequireDefault(_md);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

//#endregion

//#region Setup - Dependency Injection-----------------------------------------------
const _setting = new _simpleJsonDb2.default('./settings.json'); //#region Imports
// Library ----------------------------------------------------------------------------------

const _logger = new _logger2.Logger();
const _filePaths = new _filePaths2.FilePaths(_logger, "gmap-scrapper");
const _ipcRenderer = _electron2.default.ipcRenderer;
const _puppeteerWrapper = new _puppeteerWrapper2.PuppeteerWrapper(_logger, _filePaths, { headless: false, width: 900, height: 650 });
let scrapedData = [];
//#endregion

//#region Main ---------------------------------------------------------------------

async function main() {
	await setPlatformText();

	(0, _jquery2.default)('#licenseToText').text(_setting.get('user_email'));

	(0, _jquery2.default)('#searchBtn').on('click', async e => {
		e.preventDefault();

		(0, _jquery2.default)('table tbody').html('<tr><td class="text-center" colspan="9">Hasil pencarian kosong</td></tr>');
		(0, _jquery2.default)('#statusTxt').removeClass('text-danger').removeClass('text-warning').addClass('text-success').text('Ready');
		(0, _jquery2.default)('#resultCountText').text('0');

		const searchQuery = (0, _jquery2.default)('input#searchBusiness').val();
		const searchLimit = parseInt((0, _jquery2.default)('select#searchLimit').val());

		if (searchQuery == "") {
			_ipcRenderer.send('empty-search-query', 'Kata kunci pencarian kosong.');
			return;
		}

		(0, _jquery2.default)('input#searchBusiness').attr('disabled', 'disabled');
		(0, _jquery2.default)('input#searchLimit').attr('disabled', 'disabled');

		await GMapScrapper(searchQuery, searchLimit);
	});

	(0, _jquery2.default)('#stopBtn').on('click', async e => {
		e.preventDefault();

		await _puppeteerWrapper.cleanup();

		(0, _jquery2.default)('#searchBtn').removeAttr('disabled');
		(0, _jquery2.default)(e.target).attr('disabled', 'disabled');
		(0, _jquery2.default)('#restartBtn').attr('disabled', 'disabled');

		(0, _jquery2.default)('input#searchBusiness').removeAttr('disabled');
		(0, _jquery2.default)('input#searchLimit').removeAttr('disabled');
	});

	(0, _jquery2.default)('#restartBtn').on('click', async e => {
		e.preventDefault();

		(0, _jquery2.default)('table tbody').html('<tr><td class="text-center" colspan="9">Hasil pencarian kosong</td></tr>');
		(0, _jquery2.default)('#statusTxt').removeClass('text-danger').removeClass('text-warning').addClass('text-success').text('Ready');
		(0, _jquery2.default)('#resultCountText').text('0');

		await _puppeteerWrapper.cleanup();

		const searchQuery = (0, _jquery2.default)('input#searchBusiness').val();
		const searchLimit = parseInt((0, _jquery2.default)('select#searchLimit').val());

		if (searchQuery == "") {
			_ipcRenderer.send('empty-search-query', 'Kata kunci pencarian kosong.');
			return;
		}

		await GMapScrapper(searchQuery, searchLimit);
	});

	(0, _jquery2.default)('#exportBtn').on('click', async e => {
		_ipcRenderer.send('export-to-xlsx', scrapedData);
	});

	(0, _jquery2.default)('#clearBtn').on('click', async e => {
		(0, _jquery2.default)('table tbody').html('<tr><td class="text-center" colspan="9">Hasil pencarian kosong</td></tr>');
		(0, _jquery2.default)('#statusTxt').removeClass('text-danger').removeClass('text-warning').addClass('text-success').text('Ready');
		(0, _jquery2.default)('#resultCountText').text('0');

		await loadWebViewPage("https://www.google.com/maps/");
	});

	(0, _jquery2.default)('#licenseForm').on('submit', async e => {
		e.preventDefault();

		const email = (0, _jquery2.default)('#emailAddress').val();
		const key = (0, _jquery2.default)('#licenseKey').val();

		validateLicense(email, key);
	});
}

async function setPlatformText() {
	(0, _jquery2.default)('#systemInfo').text(_os2.default.type() + " " + " " + _os2.default.platform() + " " + " " + _os2.default.arch() + " " + _os2.default.release() + " / Mac Address " + (await getMacAddress()));
}

async function getMacAddress() {
	const interfaces = _os2.default.networkInterfaces();
	let macAddress = '00:00:00:00:00';

	console.log(interfaces);

	for (const key in interfaces) {
		if (interfaces.hasOwnProperty('Wi-Fi') || interfaces.hasOwnProperty('en1') || interfaces.hasOwnProperty('wlan0')) {
			const wirelessNetwork = interfaces['Wi-Fi'] || interfaces['en1'] || interfaces['wlan0'];
			wirelessNetwork.forEach(ifcs => {
				if (ifcs.hasOwnProperty('mac')) macAddress = ifcs['mac'];
			});
		}
	}

	return macAddress.toUpperCase();
}

async function validateLicense(email, licenseKey) {
	let signature = _setting.get('signature');

	if (signature == undefined || signature == '') {
		console.log('Generate a new signature hash.');

		const signatureParams = _os2.default.hostname() + "-" + getMacAddress();
		const signatureHash = (0, _md2.default)(signatureParams);

		_setting.set('signature', signatureHash);

		signature = signatureHash;
	}

	const baseUrl = _setting.get("license_server_url") || 'https://license.pirantisofthouse.com';
	const licenseServerUrl = `${baseUrl}/license-key/get?email=${email}&key=${licenseKey}&signature_hash=${signature}`;

	try {
		const response = await _axios2.default.get(licenseServerUrl);
		const licenseData = response.data;
		const status = licenseData.status;

		_setting.set('user_email', email);
		_setting.set('user_license', licenseKey);

		if (status === 1) _ipcRenderer.send('license-updated', "success");else _ipcRenderer.send('license-updated', "failed");
	} catch (ex) {
		console.log(ex);
	}
}

async function getPageData(url, page) {
	console.log(`Processing ${url}...`);

	await page.goto(url);

	//await loadWebViewPage(url);

	//Shop Name
	await page.waitForSelector(".x3AX1-LfntMc-header-title-title span");
	const shopName = await page.$eval(_config.CSS_SELECTOR['shop_name'], name => name.textContent);

	await page.waitForSelector(".x3AX1-LfntMc-header-title-ij8cu-haAclf");
	const reviewRating = await page.$eval(_config.CSS_SELECTOR['rating'], rating => rating.textContent);

	let reviewCount = 0;
	try {
		await page.waitForSelector(".h0ySl-wcwwM-E70qVe-list");
		reviewCount = parseInt((await page.$eval(_config.CSS_SELECTOR['reviews'], review => review.textContent)));
	} catch (exception) {
		console.log(exception);
	}

	//Shop Address
	await page.waitForSelector(".QSFF4-text.gm2-body-2:nth-child(1)");
	let address = await page.$$eval(_config.CSS_SELECTOR['address'], divs => Array.from(divs).map(div => div.innerText).find(address => address));

	if (address === undefined) {
		address = await page.$$eval(_config.CSS_SELECTOR['address_backup'], divs => divs[1]);
	}

	//Website
	try {
		await page.waitForSelector(_config.CSS_SELECTOR['website'], { timeout: 3 });
	} catch (ex) {
		console.log('No element found.');
	}

	const website = await page.$$eval(_config.CSS_SELECTOR['website'], divs => Array.from(divs).map(div => div.innerText).find(link => /^((https?|ftp|smtp):\/\/)?(www.)?[a-z0-9]+(\.[a-z]{2,}){1,3}(#?\/?[a-zA-Z0-9#]+)*\/?(\?[a-zA-Z0-9-_]+=[a-zA-Z0-9-%]+&?)?$/.test(link)));

	console.log(website || 'No website');

	const phone = await page.$$eval(
	// "#pane > div > div.widget-pane-content.cYB2Ge-oHo7ed > div > div > div:nth-child(9) > div:nth-child(2) > button > div.AeaXub > div.rogA2c > div.QSFF4-text.gm2-body-2",
	// '#pane > div > div.widget-pane-content.cYB2Ge-oHo7ed > div > div > div:nth-child(9) > div > button[data-item-id^="phone:tel:"] div.QSFF4-text.gm2-body-2',
	_config.CSS_SELECTOR['phone'], divs => Array.from(divs).map(div => div.innerText).find(phone => phone));

	console.log(phone || 'No phone');

	const latLong = await getLatLong(url);

	console.log(latLong || 'No latlong');

	let returnObj = {};

	try {
		returnObj = {
			shop: shopName.trim(),
			rating: reviewRating === undefined ? '' : reviewRating.trim(),
			reviews: reviewCount,
			address: address === undefined ? '' : address.trim(),
			website: website === undefined ? '' : website.trim(),
			phone: phone === undefined ? '' : phone.trim().replace(/\-/g, ''),
			latitude: latLong[0],
			longitude: latLong[1]
		};

		console.log(returnObj);
	} catch (exception) {
		console.log(exception);
	}

	return returnObj;
	//await browser.close();
}

//Get Links
const getLinks = async page => {
	// Scrolling to bottom of page
	let newScrollHeight = 0;
	let scrollHeight = 1000;
	let divSelector = "#pane > div > div > div > div > div:nth-child(4) > div";

	while (true) {
		await page.waitForSelector(divSelector);

		await page.evaluate((scrollHeight, divSelector) => document.querySelector(divSelector).scrollTo(0, scrollHeight), scrollHeight, divSelector);

		await page.waitForTimeout(500);

		newScrollHeight = await page.$eval(divSelector, div => div.scrollHeight);

		if (scrollHeight === newScrollHeight) {
			break;
		} else {
			scrollHeight = newScrollHeight;
		}
	}

	// Get results
	const searchResults = await page.evaluate(() => Array.from(document.querySelectorAll("a")).map(el => el.href).filter(link => link.match(/https:\/\/www.google.com\/maps\//g, link) && !link.match(/\=https:\/\/www.google.com\/maps\//g, link)));

	return searchResults;
};

async function getLatLong(url) {
	const latLongStartIndex = url.indexOf('!3d-') + 4;
	const latLongEndIndex = url.indexOf('?');
	const latLongData = url.substring(latLongStartIndex, latLongEndIndex).replace('!4d', ':');

	return latLongData.split(":");
}

async function loadWebViewPage(url) {
	const webview = document.getElementById('gmapWv');
	await webview.loadURL(url);

	webview.removeEventListener('dom-ready', loadWebViewPage);
	webview.addEventListener('dom-ready', loadWebViewPage);
}

async function GMapScrapper(searchQuery = "", maxLinks = 100) {
	console.log('Start scrapping data.');

	// Make sure this variable empty
	scrapedData = [];

	(0, _jquery2.default)('#searchBtn').attr('disabled', 'disabled');
	(0, _jquery2.default)('#stopBtn').removeAttr('disabled');
	(0, _jquery2.default)('#restartBtn').removeAttr('disabled');
	(0, _jquery2.default)('span#statusTxt').removeClass('text-success').addClass('text-danger').html('<img src="res/images/loader.gif" width="20" height="20"> Mulai scraping listing...');

	const page = await _puppeteerWrapper.newPage();

	const gmapInitUrl = "https://www.google.com/maps/"; // ?q=" + searchQuery.replace(/\s/g, '+');
	//const gmapInitUrl = "https://www.google.com/maps/search/" + searchQuery.replace(/\s/g, '+');

	await loadWebViewPage(gmapInitUrl + "?q=" + searchQuery.replace(/\s/g, '+'));

	await page.goto(gmapInitUrl);
	await page.waitForNavigation({ waitUntil: "domcontentloaded" });
	await page.waitForSelector('div#gs_lc50 input#searchboxinput');

	await page.type('div#gs_lc50 input#searchboxinput', searchQuery, { delay: 100 });
	await page.keyboard.press('Enter');

	let allLinks = [];
	let linkCount = 0;

	while (!(await page.$$eval("#pane > div > div > div > div > div > div > div", elements => Array.from(elements).some(el => el.innerText === "Tidak ditemukan hasil" || el.innerText === "No results found")))) {
		if (maxLinks !== 0 && linkCount > maxLinks) break;

		allLinks.push(...(await getLinks(page)));

		await page.$$eval("button", elements => {
			return Array.from(elements).find(el => el.getAttribute("aria-label") === "Halaman berikutnya" || el.getAttribute("aria-label") === "Next page").click();
		});

		try {
			await page.waitForNavigation({ waitUntil: "load", timeout: 3000 });
		} catch (ex) {
			break;
		}

		linkCount = allLinks.length;

		(0, _jquery2.default)('span#statusTxt').removeClass('text-danger').addClass('text-warning').html('<img src="res/images/loader.gif" width="20" height="20"> Mengumpulkan listing...');

		if (maxLinks == 0) {
			(0, _jquery2.default)('#resultCountText').text(linkCount);
		} else {
			(0, _jquery2.default)('#resultCountText').text(linkCount > maxLinks ? maxLinks : linkCount);
		}
	}

	(0, _jquery2.default)('#resultsTable tbody').html('<tr><td class="text-center" colspan="9"><p class="m-0 p-0"><img src="res/images/loader.gif" width="20" height="20"> Sedang melakukan validasi listing yang didapat...</p></td></tr>');

	console.log("All Links ", allLinks.length);

	let uniqueLinks = allLinks.filter(function (value, index, self) {
		return self.indexOf(value) === index;
	});

	if (maxLinks > 0) {
		uniqueLinks = uniqueLinks.slice(0, maxLinks);
	}

	(0, _jquery2.default)('span#statusTxt').removeClass('text-warning').addClass('text-success').html('<img src="res/images/loader.gif" width="20" height="20"> Validasi listing...');

	await (0, _delay2.default)(2000);

	console.log("Filtered Links ", uniqueLinks.length);

	(0, _jquery2.default)('#resultCountText').text(uniqueLinks.length);

	let no = 1;
	let successCount = 0;
	let failedCount = 0;
	for (let link of uniqueLinks) {
		if (maxLinks !== 0 && no > maxLinks) break;

		(0, _jquery2.default)('span#statusTxt').removeClass('text-warning').addClass('text-success').html('<img src="res/images/loader.gif" width="20" height="20"> #' + no + ' Memproses "' + link + '"');

		try {
			const data = await getPageData(link, page);
			if (no === 1) (0, _jquery2.default)('#resultsTable tbody').empty();

			(0, _jquery2.default)('#resultsTable tbody').append(`
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
			successCount++;
		} catch (ex) {
			failedCount++;
			continue;
		}

		await _delay2.default.range(100, 1000);
	}

	(0, _jquery2.default)('#searchBtn').removeAttr('disabled');
	(0, _jquery2.default)('#stopBtn').attr('disabled', 'disabled');
	(0, _jquery2.default)('#restartBtn').attr('disabled', 'disabled');

	(0, _jquery2.default)('input#searchBusiness').removeAttr('disabled');
	(0, _jquery2.default)('input#searchLimit').removeAttr('disabled');

	await _puppeteerWrapper.cleanup();

	const doneMessage = `Proses scraping dengan kata kunci "${searchQuery}" telah selesai dengan statistik berikut: ${successCount} berhasil, ${failedCount} gagal`;

	(0, _jquery2.default)('span#statusTxt').removeClass('text-danger').addClass('text-success').text(doneMessage);

	_ipcRenderer.send('scraping-done', doneMessage);
}

_ipcRenderer.on('chrome-path-is-set', (event, arg) => {
	(0, _jquery2.default)('span#chromeInfo').addClass('text-success').text(arg);
});

(async () => {
	try {
		const chromeSet = await _puppeteerWrapper.setup();
		if (!chromeSet) {
			_ipcRenderer.send('chrome-not-found');
		} else {
			(0, _jquery2.default)('span#chromeInfo').addClass('text-success').text(_puppeteerWrapper._getSavedPath());
		}

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
//# sourceMappingURL=index.js.map