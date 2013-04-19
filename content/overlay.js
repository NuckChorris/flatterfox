Components.utils.import('resource://gre/modules/Services.jsm');

const CC = Components.classes, CI = Components.interfaces;
let prefService = CC['@mozilla.org/preferences-service;1'].getService(CI.nsIPrefService);
let prefBranch = prefService.getBranch('extensions.flatterfox.')
prefBranch.QueryInterface(CI.nsIPrefBranch2);
let styleService = CC['@mozilla.org/content/style-sheet-service;1'].getService(CI.nsIStyleSheetService);
let ioService = CC['@mozilla.org/network/io-service;1'].getService(CI.nsIIOService);
let mainWindow = Services.wm.getMostRecentWindow('navigator:browser');
let scriptableStream = CC["@mozilla.org/scriptableinputstream;1"].getService(Components.interfaces.nsIScriptableInputStream);

const sheets = {
	prefix: '@namespace url("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"); ',
	suffix: '',
	embedCSS: function (css) {
		var sheet = ioService.newURI(this.getEmbedURI(css), null, null);
		this.register(sheet);
		return sheet;
	},
	register: function (sheet) {
		if (!styleService.sheetRegistered(sheet, styleService.USER_SHEET))
			styleService.loadAndRegisterSheet(sheet, styleService.USER_SHEET);
	},
	unregister: function (sheet) {
		if (styleService.sheetRegistered(sheet, styleService.USER_SHEET))
			styleService.unregisterSheet(sheet, styleService.USER_SHEET);
	},
	getEmbedURI: function (css) {
		return 'data:text/css;charset=utf-8,' + encodeURIComponent(this.prefix + css + this.suffix);
	}
};

function Curly (template, obj) {
	if (arguments.length === 1) {
		return template;
	} else if (arguments.length === 2) {
		if (arguments[1] == null) {
			return template;
		} else if (typeof arguments[1] === 'object') {
			var obj = arguments[1];
		} else if (typeof arguments[1] === 'Array') {
			var obj = arguments[1];
		} else {
			var obj = [arguments[1]];
		}
	} else if (arguments.length > 1) {
		var obj = Array.slice.call(arguments, 1);
	} else {
		return template;
	}

	return template.replace(/\{([a-zA-Z\.0-9]*)\}/mg, function (match, key) {
		var parts = key.split('.'), o = obj;

		for (var i = 0, l = parts.length; i < l; ++i) {
			if (!o[parts[i]] || o[parts[i]] === null) return match;

			o = o[parts[i]];
		}
		return o;
	});
};

const FlatterFox = {
	prefs: null,
	currentStyle: null,
	customTemplate: null,
	styles: {
		fgcolor: null,
		bgcolor: null,
		font: null
	},
	startup: function () {
		this.prefs = prefBranch;
		this.prefs.addObserver("", this, false);
		this.loadPrefs();

		// Now we load the customizable styles from a file
		var input = ioService.newChannel("chrome://flatterfox/content/customized.css", null, null).open();
		scriptableStream.init(input);
		this.customTemplate = scriptableStream.read(input.available());
		scriptableStream.close();
		input.close();

		this.stylePrefs();
	},
	shutdown: function () {
		this.prefs.removeObserver("", this);
	},
	loadPrefs: function () {
		this.styles.fgcolor = this.prefs.getCharPref("styles.fgcolor").toUpperCase();
		this.styles.bgcolor = this.prefs.getCharPref("styles.bgcolor").toUpperCase();
		this.styles.font    = this.prefs.getCharPref("styles.font");
	},
	observe: function (subject, topic, data) {
		if (topic == "nsPref:changed") this.loadPrefs();
	},
	setValue: function (key, value) {
		this.prefs.setCharPref(key, value);
	},
	swapCSS: function (newCSS) {
		if (this.currentStyle) sheets.disable(this.currentStyle);
		this.currentSyle = sheets.embedCSS(newCSS);
	},
	stylePrefs: function () {
		this.swapCSS(Curly(this.customTemplate, this));
	}
};

window.addEventListener("load", function(e) { FlatterFox.startup(); }, false);
window.addEventListener("unload", function(e) { FlatterFox.shutdown(); }, false);
