"use strict";

// const puppeteer = require("puppeteer"); /// import puppeteer from "puppeteer";
// const xlsx = require("xlsx");

// Get the data
async function getPageData(url, page) {
	await page.goto(url);

	//Shop Name
	await page.waitForSelector(".x3AX1-LfntMc-header-title-title span");
	const shopName = await page.$eval(".x3AX1-LfntMc-header-title-title span", name => name.textContent);

	await page.waitForSelector(".x3AX1-LfntMc-header-title-ij8cu-haAclf");
	const reviewRating = await page.$eval(".x3AX1-LfntMc-header-title-ij8cu-haAclf span > span > span", rating => rating.textContent);

	await page.waitForSelector(".x3AX1-LfntMc-header-title-ij8cu-haAclf");
	const reviewCount = await page.$eval(".x3AX1-LfntMc-header-title-ij8cu-haAclf span button.widget-pane-link", review => review.textContent);

	//Shop Address
	await page.waitForSelector(".QSFF4-text.gm2-body-2:nth-child(1)");
	let address = await page.$$eval("#pane > div > div > div > div > div > div > button > div > div > div", divs => Array.from(divs).map(div => div.innerText).find(address => address));

	if (address === undefined) {
		address = await page.$$eval("#pane > div > div > div > div > div > div > button > div > div > div", divs => divs[1]);
	}

	//Website
	try {
		await page.waitForSelector(".HY5zDd", { timeout: 3 });
	} catch (ex) {
		console.log('No element found.');
	}

	const website = await page.$$eval("#pane > div > div > div > div > div > div > button > div > div > div", divs => Array.from(divs).map(div => div.innerText).find(link => /^((https?|ftp|smtp):\/\/)?(www.)?[a-z0-9]+(\.[a-z]{2,}){1,3}(#?\/?[a-zA-Z0-9#]+)*\/?(\?[a-zA-Z0-9-_]+=[a-zA-Z0-9-%]+&?)?$/.test(link)));

	const phone = await page.$$eval(
	// "#pane > div > div.widget-pane-content.cYB2Ge-oHo7ed > div > div > div:nth-child(9) > div:nth-child(2) > button > div.AeaXub > div.rogA2c > div.QSFF4-text.gm2-body-2",
	'#pane > div > div.widget-pane-content.cYB2Ge-oHo7ed > div > div > div:nth-child(9) > div > button[data-item-id^="phone:tel:"] div.QSFF4-text.gm2-body-2', divs => Array.from(divs).map(div => div.innerText).find(phone => phone));

	let returnObj = {
		shop: shopName.trim(),
		reviewRating: reviewRating.trim(),
		reviewCount: reviewCount.trim(),
		address: address.trim(),
		website: website.trim(),
		phone: phone.replace('-', '').trim(),
		latLong: await getLatLong(url)
	};

	console.log(returnObj);

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

		await page.waitForTimeout(300);

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

	return url.substring(latLongStartIndex, latLongEndIndex).replace('!4d', ':');
}

async function GMapScrapper(page, searchQuery = "flower shop") {
	console.log('Star scrapping data.');

	await page.goto("https://www.google.com/maps/?q=" + searchQuery);
	await page.waitForNavigation({ waitUntil: "domcontentloaded" });
	await page.waitForTimeout(4000);

	let allLinks = [];

	while (!(await page.$$eval("#pane > div > div > div > div > div > div > div", elements => Array.from(elements).some(el => el.innerText === "Tidak ditemukan hasil" || el.innerText === "No results found")))) {
		allLinks.push(...(await getLinks(page)));

		await page.$$eval("button", elements => {
			return Array.from(elements).find(el => el.getAttribute("aria-label") === "Halaman berikutnya").click();
		});

		await page.waitForNavigation({ waitUntil: "load" });
	}

	console.log(allLinks);

	const scrapedData = [];

	for (let link of allLinks) {
		const data = await getPageData(link, page);
		scrapedData.push(data);
	}

	console.log(scrapedData);
}

module.exports = GMapScrapper;
//# sourceMappingURL=gmap.js.map