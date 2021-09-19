'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.PuppeteerWrapper = undefined;

var _puppeteerCore = require('puppeteer-core');

var _puppeteerCore2 = _interopRequireDefault(_puppeteerCore);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * chromePath:  the path of the chrome executable in our pc
 * setup() :    initialize Puppeteer
 * cleanup():   clearnup Puppeteer
 * browser:     global Puppeteer browser instance
 * newPage():   get new page with default user agent and dimensions
 */

/**
 * options: {headless, width, height}
 */
class PuppeteerWrapper {
    constructor(logger, filePaths, options) {
        this._logger = logger;
        this._filePaths = filePaths;
        this._options = options || { headless: true };

        // Public
        this.chromePath = undefined;
        this.browser = undefined;
    }

    //#region Public API setup - cleanup

    async setup() {
        const isChromePathSet = await this._setChromePath();
        if (!isChromePathSet) {
            return false;
        }

        const args = [];
        if (this._options.width) {
            args.push(`--window-size=${this._options.width},${this._options.height}`);
        }

        this._logger.logInfo("Setting up puppeteer...");
        this.browser = await _puppeteerCore2.default.launch({
            headless: this._options.headless,
            executablePath: this.chromePath,
            args
        });
        this._logger.logInfo("Puppeteer initialized");
        return true;
    }

    async cleanup() {
        if (this.browser) await this.browser.close();
    }

    async newPage() {
        await this.cleanup();
        await this.setup();

        const page = await this.browser.newPage();
        page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36');

        if (this._options.width) {
            await page._client.send('Emulation.clearDeviceMetricsOverride');
        }
        return page;
    }

    //#endregion

    //#region Helpers

    async _setChromePath() {
        this.chromePath = await this._getSavedPath();
        if (this.chromePath) {
            if (_fs2.default.existsSync(this.chromePath)) return true;

            // The saved path does not exists
            this._logger.logError(`Saved Chrome path does not exists: ${this.chromePath}`);
        }

        // Try the default path
        this.chromePath = this._getDefaultOsPath();
        if (!_fs2.default.existsSync(this.chromePath)) {
            this._logger.logError(`Default chrome path does not exists: ${this.chromePath}`);
            this._logger.logError(`Try to set chrome path in settings file: ${this._filePaths.settingsPath()}`);
            return false;
        }

        return true;
    }

    _getSavedPath() {
        const settingsPath = this._filePaths.settingsPath();

        return new Promise((resolve, reject) => {
            if (!_fs2.default.existsSync(settingsPath)) {
                resolve(undefined);
                return;
            }
            _fs2.default.readFile(settingsPath, "utf8", (err, fileContent) => {
                if (err) {
                    this._logger.logError(err);
                    reject();
                    return;
                }

                resolve(fileContent);
            });
        });
    }

    _getDefaultOsPath() {
        if (process.platform === "win32") {
            return 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
        } else {
            return '/usr/bin/google-chrome';
        }
    }

    //#endregion
}
exports.PuppeteerWrapper = PuppeteerWrapper;
//# sourceMappingURL=puppeteer-wrapper.js.map