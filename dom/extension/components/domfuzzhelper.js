"use strict";

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/NetUtil.jsm");

function dumpln(s) { dump(s + "\n"); }


/*****************
 * API INJECTION *
 *****************/

// Based on:
// https://bug549539.bugzilla.mozilla.org/attachment.cgi?id=429661
// https://developer.mozilla.org/en/XPCOM/XPCOM_changes_in_Gecko_1.9.3
// http://mxr.mozilla.org/mozilla-central/source/toolkit/components/console/hudservice/HUDService.jsm#3240
// https://developer.mozilla.org/en/how_to_build_an_xpcom_component_in_javascript

function DOMFuzzHelper() {}

// Use runSoon to avoid false-positive leaks due to content JS on the stack (?)
function quitFromContent() { dumpln("Page called quitApplication."); runSoon(goQuitApplication); }
function quitApplicationSoon() { dumpln("Page called quitApplicationSoon."); runOnTimer(goQuitApplication); }

DOMFuzzHelper.prototype = {
  classDescription: "DOM fuzz helper",
  classID:          Components.ID("{59a52458-13e0-4d90-9d85-a637344f29a1}"),
  contractID:       "@squarefree.com/dom-fuzz-helper;1",

  QueryInterface:   XPCOMUtils.generateQI([Ci.nsIDOMGlobalPropertyInitializer]),

  init: function(aWindow)
  {
    // Using bind(this) to ensure web page gets a *copy* of the function (is this necessary?)

    var api = {
      quitApplication:     quitFromContent.bind(this),
      quitApplicationSoon: quitApplicationSoon.bind(this),
      closeTabThenQuit:    closeTabThenQuit(aWindow),
      quitWithLeakCheck:   quitWithLeakCheck.bind(this),
      setGCZeal:           setGCZeal.bind(this),
      runSoon:             runSoon.bind(this),
      enableAccessibility: enableAccessibility.bind(this),
      GC:                  function() { Components.utils.forceGC(); },
      MP:                  sendMemoryPressureNotification.bind(this),
      CC:                  cycleCollect(aWindow),
      fontList:            fontList.bind(this),
      // zoom:             setZoomLevel(aWindow), // bug 576927
      printToFile:         printToFile(aWindow),

      __exposedProps__: {
        quitApplication: "r",
        quitApplicationSoon: "r",
        closeTabThenQuit: "r",
        quitWithLeakCheck: "r",
        setGCZeal: "r",
        runSoon: "r",
        enableAccessibility: "r",
        GC: "r",
        MP: "r",
        CC: "r",
        fontList: "r",
        // zoom: "r",
        printToFile: "r",
      }
    };

    return api;
  }
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([DOMFuzzHelper]);



/*****************************
 * MISC PRIVILEGED FUNCTIONS *
 *****************************/

function closeTabThenQuit(w)
{
  return function() {
    runOnTimer(goQuitApplication);
    w.close();
  }
}

function fontList()
{
  return Components.classes["@mozilla.org/gfx/fontenumerator;1"]
          .createInstance(Components.interfaces.nsIFontEnumerator)
          .EnumerateAllFonts({})
          .join("\n");
}

function runSoon(f)
{
  var tm = Components.classes["@mozilla.org/thread-manager;1"]
             .getService(Components.interfaces.nsIThreadManager);

  tm.mainThread.dispatch({
    run: function() {
      f();
    }
  }, Components.interfaces.nsIThread.DISPATCH_NORMAL);
}


function enableAccessibility()
{
  try {
    Components.classes["@mozilla.org/accessibilityService;1"]
      .getService(Components.interfaces.nsIAccessibleRetrieval);
    dump("Enabled accessibility!\n");
  } catch(e) {
    dump("Couldn't enable accessibility: " + e + "\n");
  }
}

function sendMemoryPressureNotification()
{
  var os = Components.classes["@mozilla.org/observer-service;1"]
           .getService(Components.interfaces.nsIObserverService);
  os.notifyObservers(null, "memory-pressure", "heap-minimize");
}

function cycleCollect(window)
{
  return function cycleCollectInner() {
    window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
          .getInterface(Components.interfaces.nsIDOMWindowUtils)
          .cycleCollect();
  }
}

function setZoomLevel(window)
{
  return function setZoomLevelInner(textOrFull, factor) {
    var viewer = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                       .getInterface(Components.interfaces.nsIWebNavigation)
                       .QueryInterface(Components.interfaces.nsIDocShell)
                       .contentViewer
                       .QueryInterface(Components.interfaces.nsIMarkupDocumentViewer);

    if (textOrFull == "text")
      viewer.textZoom = +factor;
    else if (textOrFull == "full")
      viewer.fullZoom = +factor;
  }
}

function printToFile(window)
{
  // Oddly asynchronous, at least on Linux.

  // Linux: works for PDF and PS.
  // Windows: works for PDF at least. Text may be invisible (bug 653336).
  // Mac: tested, printToFile is ignored and it goes to a printer!
  var xulRuntime = Components.classes["@mozilla.org/xre/app-info;1"]
                             .getService(Components.interfaces.nsIXULRuntime);
  dumpln("xulRuntime.OS: " + xulRuntime.OS);
  if (xulRuntime.OS != "Linux" && xulRuntime.OS != "WINNT") return function() { };

  var fired = false;

  return function printToFileInner(showHeaders, showBGColor, showBGImages, ps) {
    runSoon(function() {
        // Don't print more than once, it gets messy fast.
        if (fired) { return false; }
        fired = true;

        // Based on https://addons.mozilla.org/en-US/firefox/addon/5971/ by pavlov (Stuart Parmenter) and bho

        var webBrowserPrint = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
        .getInterface(Components.interfaces.nsIWebBrowserPrint);

        var nsIPrintSettings = Components.interfaces.nsIPrintSettings;

        var PSSVC = Components.classes["@mozilla.org/gfx/printsettings-service;1"]
        .getService(Components.interfaces.nsIPrintSettingsService);

        var printSettings = PSSVC.newPrintSettings;

        var file = Components.classes["@mozilla.org/file/directory_service;1"].
                              getService(Components.interfaces.nsIProperties).
                              get("ProfD", Components.interfaces.nsIFile);
        file.append(ps ? "fuzzout.ps" : "fuzzout.pdf");
        dumpln("Printing to: " + file.path);

        printSettings.printToFile = true;
        printSettings.toFileName  = file.path;
        printSettings.printSilent = true;
        printSettings.outputFormat = ps ? nsIPrintSettings.kOutputFormatPS : nsIPrintSettings.kOutputFormatPDF;
        printSettings.printBGColors   = !!showBGColor;
        printSettings.printBGImages   = !!showBGImages;
        if (!showHeaders) {
            printSettings.footerStrCenter = '';
            printSettings.footerStrLeft   = '';
            printSettings.footerStrRight  = '';
            printSettings.headerStrCenter = '';
            printSettings.headerStrLeft   = '';
            printSettings.headerStrRight  = '';
        }

        webBrowserPrint.print(printSettings, null);
    });
  }
}

function setGCZeal(zeal)
{
  if (typeof(zeal) == "number") {
    Services.prefs.setIntPref("javascript.options.gczeal", zeal)
  }
}



/************************
 * QUIT WITH LEAK CHECK *
 ************************/

var quitting = false;

function quitWithLeakCheck(leaveWindowsOpen)
{
  leaveWindowsOpen = !!leaveWindowsOpen;

  // Magic string that rundomfuzz.py looks for
  var messagePrefix = "Leaked until " + (leaveWindowsOpen ? "tab close" : "shutdown");

  if (quitting)
    return;
  quitting = true;

  runSoon(a);
  function a() { dumpln("QA"); if (!leaveWindowsOpen) closeAllWindows(); runOnTimer(b); dumpln("QAA"); }
  function b() { dumpln("QB"); mpUntilDone(c); }
  function c() { dumpln("QC"); bloatStats(d); }
  function d(objectCounts) {
    dumpln("QD");

    // Mac normally has extra documents (due to the hidden window?)
    var isMac = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS == "Darwin";

    var expected = {
      'nsGlobalWindow':          4 + 6*leaveWindowsOpen,
      'nsDocument':              4 + 4*isMac + 24*leaveWindowsOpen,
      'nsDocShell':              5,
      'BackstagePass':           1,
      'nsGenericElement':        1927,
      'nsHTMLDivElement':        4,
      'xpc::CompartmentPrivate': 3,
    }

    for (var p in expected) {
      if (objectCounts[p] > expected[p]) {
        dumpln(messagePrefix + ": " + p + "(" + objectCounts[p] + " > " + expected[p] + ")");
      } else if (objectCounts[p] < expected[p]) {
        dumpln("That's odd"  + ": " + p + "(" + objectCounts[p] + " < " + expected[p] + ")");
      }
    }

    runSoon(e);
  }
  function e() { dumpln("QE"); goQuitApplication(); }
}

var timerDeathGrip;
function runOnTimer(f)
{
    timerDeathGrip = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
    timerDeathGrip.initWithCallback({notify: function(){ timerDeathGrip=null; f(); }}, 2000, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
}

function closeAllWindows()
{
  var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                     .getService(Ci.nsIWindowWatcher);
  var enumerator = ww.getWindowEnumerator();

  var windowsToClose = [];

  while (enumerator.hasMoreElements()) {
    windowsToClose.push(enumerator.getNext().QueryInterface(Ci.nsIDOMWindow));
  }

  // if not mac...
  ww.openWindow(null, "about:blank", null, "width=200,height=200", null);

  for (var i = 0; i < windowsToClose.length; ++i) {
    windowsToClose[i].close();
  }

  dumpln("1");
}

function mpUntilDone(callback)
{
  function mpUntilDoneInner()
  {
    dumpln("MP " + j);
    sendMemoryPressureNotification();

    ++j;
    if (j > 9)
      runSoon(callback);
    else if (j % 2 == 1 && typeof Components.utils.schedulePreciseGC == "function")
      Components.utils.schedulePreciseGC(mpUntilDoneInner)
    else
      runSoon(mpUntilDoneInner);
  }

  var j = 0;
  mpUntilDoneInner();
}


/*
     |<----------------Class--------------->|<-----Bytes------>|<----------------Objects---------------->|<--------------References-------------->|
                                              Per-Inst   Leaked    Total      Rem      Mean       StdDev     Total      Rem      Mean       StdDev

*/
// Grab the class name and the number of remaining objects.
var bloatRex = /\s*\d+\s+(\S+)\s+\d+\s+\d+\s+\d+\s+(\d+)\s+.*/;
const SET_QUOTA = false;
const USE_QUOTA = false;

function bloatStats(callback)
{
  var objectCounts = {};

  try {
    //d.d.d;
    NetUtil.asyncFetch("about:bloat", fetched);
  } catch(e) {
    dumpln("Can't open about:bloat -- maybe you forgot to use XPCOM_MEM_LEAK_LOG");
    callback(objectCounts);
  }

  function fetched(aInputStream, aResult)
  {
    var r = NetUtil.readInputStreamToString(aInputStream, aInputStream.available());
    var lines = r.split("\n");
    for (var i = 0; i < lines.length; ++i)
    {
      var a = bloatRex.exec(lines[i]);
      if (a) {
        if (SET_QUOTA) {
          dumpln("'" + a[1] + "': " + a[2] + ",");
        } else if (USE_QUOTA) {
          var quotaA = QUOTA[a[1]] || 0;
          if (a[2] > quotaA) { dumpln("Leak? Too many " + a[1] + " (" + a[2] + " > " + quotaA + ")"); }
        }
        objectCounts[a[1]] = a[2];
      }
    }
    runSoon(callCallback);
  }

  function callCallback()
  {
    callback(objectCounts)
  }
}


/********
 * QUIT *
 ********/

// From quit.js, which Bob Clary extracted from mozilla/toolkit/content

function canQuitApplication()
{
  var os = Components.classes["@mozilla.org/observer-service;1"]
    .getService(Components.interfaces.nsIObserverService);
  if (!os)
  {
    return true;
  }

  try
 {
    var cancelQuit = Components.classes["@mozilla.org/supports-PRBool;1"]
      .createInstance(Components.interfaces.nsISupportsPRBool);
    os.notifyObservers(cancelQuit, "quit-application-requested", null);

    // Something aborted the quit process.
    if (cancelQuit.data)
    {
      return false;
    }
  }
  catch (ex)
  {
  }
  os.notifyObservers(null, "quit-application-granted", null);
  return true;
}

function goQuitApplication()
{
  dumpln("goQuitApplication (js component)");

  if (!canQuitApplication())
  {
    return false;
  }

  var kAppStartup = '@mozilla.org/toolkit/app-startup;1';
  var kAppShell   = '@mozilla.org/appshell/appShellService;1';
  var   appService;
  var   forceQuit;

  if (kAppStartup in Components.classes)
  {
    appService = Components.classes[kAppStartup].
      getService(Components.interfaces.nsIAppStartup);
    forceQuit  = Components.interfaces.nsIAppStartup.eForceQuit;

  }
  else if (kAppShell in Components.classes)
  {
    appService = Components.classes[kAppShell].
      getService(Components.interfaces.nsIAppShellService);
    forceQuit = Components.interfaces.nsIAppShellService.eForceQuit;
  }
  else
  {
    throw 'goQuitApplication: no AppStartup/appShell';
  }

  var windowManager = Components.
    classes['@mozilla.org/appshell/window-mediator;1'].getService();

  var windowManagerInterface = windowManager.
    QueryInterface(Components.interfaces.nsIWindowMediator);

  var enumerator = windowManagerInterface.getEnumerator(null);

  while (enumerator.hasMoreElements())
  {
    var domWindow = enumerator.getNext();
    if (("tryToClose" in domWindow) && !domWindow.tryToClose())
    {
      return false;
    }
    domWindow.close();
  }

  try
  {
    appService.quit(forceQuit);
  }
  catch(ex)
  {
    throw('goQuitApplication: ' + ex);
  }

  return true;
}

