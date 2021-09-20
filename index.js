const electron = require('electron');
const XLSX = require('xlsx');

// Module to control application life.
const app = electron.app;
const ipcMain = electron.ipcMain;

// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

const { join } = require('path');
const path = require('path');
const url = require('url');
const JSONdb = require('simple-json-db');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

// Use JSON file for storage
const file = join(__dirname, 'data/db.json');
const db = new JSONdb(file);

function createWindow() {
	// Create the browser window.
	mainWindow = new BrowserWindow({
		width: 1366,
		height: 768,
		icon: './assets/icons/favicon-32x32.png',
		webPreferences: {
			worldSafeExecuteJavaScript: true, // required for Electron 12+
			contextIsolation: false, // required for Electron 12+
			nodeIntegration: true,
			enableRemoteModule: true,
			webviewTag: true
		}
	});

	mainWindow.maximize();

	// and load the index.html of the app.
	mainWindow.loadURL(
		url.format({
			pathname: path.join(__dirname, 'index.html'),
			protocol: 'file:',
			slashes: true
		})
	);

	// Open the DevTools.
	// mainWindow.webContents.openDevTools()

	mainWindow.setTitle(`${app.getName()}-${app.getVersion()}`);

	// Emitted when the window is closed.
	mainWindow.on('closed', function () {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		mainWindow = null;
	});
}
if (app.setAboutPanelOptions) app.setAboutPanelOptions({
	applicationName: 'GMap Scrapper',
	applicationVersion: '1.0.0',
	copyright: "(C) 2021-present SDM" });

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
	// On OS X it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', function () {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (mainWindow === null) {
		createWindow();
	}
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
const dialog = electron.dialog;
const EXTENSIONS = "xls|xlsx|xlsm|xlsb|xml|csv|txt|dif|sylk|slk|prn|ods|fods|htm|html".split("|");
ipcMain.on('export-to-xlsx', async function(evt){
	const wb = XLSX.utils.book_new();
	wb.Props = {
		Title: "GMap Scraper Results",
		Subject: "GMap Scraper Results",
		Author: "GMap Scraper v1.0.0",
		CreatedDate: new Date()
	};
	wb.SheetNames.push("Sheet 1");

	const dbData = db.get('businesses');
	const wbData = [];

	for (let i = 0; i < dbData.length; i++) {
		if (i === 0) wbData.push(Object.keys(dbData[i]));

		wbData.push(Object.values(dbData[i]));
	}

	const ws = XLSX.utils.aoa_to_sheet(wbData);

	wb.Sheets["Sheet 1"] = ws;

	const o = await dialog.showSaveDialog({
		title: 'Save file as',
		filters: [{
			name: "Spreadsheets",
			extensions: EXTENSIONS
		}]
	});

	console.log(wb);

	XLSX.writeFile(wb, o.filePath);

	dialog.showMessageBox({ message: "Exported data to " + o.filePath, buttons: ["OK"] });
});
