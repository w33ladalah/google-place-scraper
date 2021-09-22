'use strict';

var _electron = require('electron');

var _electron2 = _interopRequireDefault(_electron);

var _logger2 = require('./lib/logger');

var _filePaths2 = require('./lib/file-paths.js');

var _puppeteerWrapper2 = require('./lib/puppeteer-wrapper');

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
//#region Imports
// Library ----------------------------------------------------------------------------------
const _setting = new _simpleJsonDb2.default('./settings.json');
const _logger = new _logger2.Logger();
const _filePaths = new _filePaths2.FilePaths(_logger, "gmap-scrapper");
const _ipcRenderer = _electron2.default.ipcRenderer;
const _puppeteerWrapper = new _puppeteerWrapper2.PuppeteerWrapper(_logger, _filePaths, { headless: false, width: 900, height: 650 });

let scrapedData = [];
//#endregion

//#region Main ---------------------------------------------------------------------

async function main() {
	await _puppeteerWrapper._getSavedPath();

	await setPlatformText();
	await getNetworkInterface();

	(0, _jquery2.default)('#licenseToText').text('Lisensi kepada: ' + _setting.get('user_email'));

	(0, _jquery2.default)('#searchBtn').on('click', async e => {
		e.preventDefault();

		(0, _jquery2.default)('table tbody').html('<tr><td class="text-center" colspan="9">Hasil pencarian kosong</td></tr>');
		(0, _jquery2.default)('#statusTxt').removeClass('text-danger').removeClass('text-warning').addClass('text-success').text('Ready');
		(0, _jquery2.default)('#resultCountText, #validResultCountText').text('0');

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
		(0, _jquery2.default)('#resultCountText, #validResultCountText').text('0');

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
		(0, _jquery2.default)('#resultCountText, #validResultCountText').text('0');

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
	(0, _jquery2.default)('#systemInfo').text(_os2.default.type() + " " + " " + _os2.default.platform() + " " + " " + _os2.default.arch() + " " + _os2.default.release());
}

async function getNetworkInterface() {
	const interfaces = _os2.default.networkInterfaces();

	for (const key in interfaces) {
		if (interfaces.hasOwnProperty('Wi-Fi') || interfaces.hasOwnProperty('en1')) {
			const wirelessNetwork = interfaces[key];
			wirelessNetwork.forEach(ifcs => {
				let mac = ifcs.hasOwnProperty('mac') ? ifcs['mac'] : '00:00:00:00:00:00';
				if (mac != '00:00:00:00:00:00') {
					return mac;
				}
			});
		}
	}
}

async function validateLicense(email, licenseKey) {
	let signature = _setting.get('signature');

	if (signature == undefined || signature == '') {
		console.log('Generate a new signature hash.');

		const signatureParams = _os2.default.hostname() + "-" + getNetworkInterface();
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
	await page.goto(url);

	//await loadWebViewPage(url);

	//Shop Name
	try {
		await page.waitForSelector(".x3AX1-LfntMc-header-title-title span", { timeout: 3 });
	} catch (ex) {
		console.log('No rating found.');
	}
	const shopName = await page.$eval(".x3AX1-LfntMc-header-title-title span", name => name.textContent);

	try {
		await page.waitForSelector(".x3AX1-LfntMc-header-title-ij8cu-haAclf", { timeout: 3 });
	} catch (ex) {
		console.log('No rating found.');
	}

	const reviewRating = await page.$eval(".x3AX1-LfntMc-header-title-ij8cu-haAclf span > span > span", rating => rating.textContent);

	try {
		await page.waitForSelector(".x3AX1-LfntMc-header-title-ij8cu-haAclf", { timeout: 3 });
	} catch (ex) {
		console.log('No review found.');
	}

	const reviewCount = await page.$eval(".x3AX1-LfntMc-header-title-ij8cu-haAclf span button.widget-pane-link", review => review.textContent);

	//Shop Address
	try {
		await page.waitForSelector(".QSFF4-text.gm2-body-2:nth-child(1)", { timeout: 3 });
	} catch (ex) {
		console.log('No address found.');
	}

	let address = await page.$$eval("#pane > div > div > div > div > div > div > button > div > div > div", divs => Array.from(divs).map(div => div.innerText).find(address => address));

	if (address === undefined) {
		address = await page.$$eval("#pane > div > div > div > div > div > div > button > div > div > div", divs => divs[1]);
	}

	//Website
	try {
		await page.waitForSelector(".HY5zDd", { timeout: 3 });
	} catch (ex) {
		console.log('No website found.');
	}

	const website = await page.$$eval("#pane > div > div > div > div > div > div > button > div > div > div", divs => Array.from(divs).map(div => div.innerText).find(link => /^((https?|ftp|smtp):\/\/)?(www.)?[a-z0-9]+(\.[a-z]{2,}){1,3}(#?\/?[a-zA-Z0-9#]+)*\/?(\?[a-zA-Z0-9-_]+=[a-zA-Z0-9-%]+&?)?$/.test(link)));

	const phone = await page.$$eval(
	// "#pane > div > div.widget-pane-content.cYB2Ge-oHo7ed > div > div > div:nth-child(9) > div:nth-child(2) > button > div.AeaXub > div.rogA2c > div.QSFF4-text.gm2-body-2",
	'#pane > div > div.widget-pane-content.cYB2Ge-oHo7ed > div > div > div:nth-child(9) > div > button[data-item-id^="phone:tel:"] div.QSFF4-text.gm2-body-2', divs => Array.from(divs).map(div => div.innerText).find(phone => phone));

	const latLong = await getLatLong(url);

	let returnObj = {
		shop: shopName.trim(),
		rating: reviewRating === undefined ? '' : reviewRating.trim(),
		reviews: reviewCount === undefined ? '' : reviewCount.trim(),
		address: address === undefined ? '' : address.trim(),
		website: website === undefined ? '' : website.trim(),
		phone: phone === undefined ? '' : phone.trim().replace(/\-/g, ''),
		latitude: latLong[0],
		longitude: latLong[1]
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
	(0, _jquery2.default)('span#statusTxt').removeClass('text-success').addClass('text-danger').text('Start scraping...');

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

		allLinks = allLinks.filter((value, index, self) => {
			return self.indexOf(value) === index;
		});

		linkCount = allLinks.length;

		(0, _jquery2.default)('span#statusTxt').removeClass('text-danger').addClass('text-warning').text('Gathering links...');

		if (maxLinks == 0) {
			(0, _jquery2.default)('#resultCountText').text(linkCount);
		} else {
			(0, _jquery2.default)('#resultCountText').text(linkCount > maxLinks ? maxLinks : linkCount);
		}

		await page.$$eval("button", elements => {
			return Array.from(elements).find(el => el.getAttribute("aria-label") === "Halaman berikutnya" || el.getAttribute("aria-label") === "Next page").click();
		});

		await page.waitForNavigation({ waitUntil: "load" });
	}

	(0, _jquery2.default)('#resultsTable tbody').html('<tr><td class="text-center" colspan="9"><p>Data sedang diproses...</p></td></tr>');

	let uniqueLinks = allLinks.filter((value, index, self) => {
		return self.indexOf(value) === index;
	});

	const linksDb = new _simpleJsonDb2.default('data/links-' + searchQuery.replace(/\s/g, '-') + '-' + Date.now() + '.json');

	linksDb.set('data', uniqueLinks);

	(0, _jquery2.default)('#validResultCountText').text(uniqueLinks.length);

	let no = 1;
	for (let link of uniqueLinks) {
		if (maxLinks !== 0 && no > maxLinks) break;

		(0, _jquery2.default)('span#statusTxt').removeClass('text-warning').addClass('text-success').text('Processing "' + link + '"');

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

		await _delay2.default.range(100, 1000);
	}

	(0, _jquery2.default)('#searchBtn').removeAttr('disabled');
	(0, _jquery2.default)('#stopBtn').attr('disabled', 'disabled');
	(0, _jquery2.default)('#restartBtn').attr('disabled', 'disabled');

	(0, _jquery2.default)('input#searchBusiness').removeAttr('disabled');
	(0, _jquery2.default)('input#searchLimit').removeAttr('disabled');

	await _puppeteerWrapper.cleanup();

	(0, _jquery2.default)('span#statusTxt').removeClass('text-danger').addClass('text-success').text('Done!');
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
			(0, _jquery2.default)('span#chromeInfo').addClass('text-success').text((await _puppeteerWrapper._getSavedPath()) || (await _puppeteerWrapper._getDefaultOsPath()));
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