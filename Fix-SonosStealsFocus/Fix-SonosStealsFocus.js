"use strict";

// GOAL: Inject .net, switch to the correct AppDomain, invoke on UI thread, mutate the window.

const CLR = require('../common/dotnet');
const System = new CLR.Namespace("System");

setTimeout(function() {
    console.log("Current AppDomain: " + System.AppDomain.CurrentDomain.FriendlyName);
    console.log("AppDomains: " + CLR.ListAppDomains());

    console.log("[*] Switching to 'WpfDomain'");
    CLR.SwitchToAppDomain("WpfDomain", function () {
        console.log("Current domain: " + System.AppDomain.CurrentDomain.FriendlyName);
        
        System.Windows.Application.Current.Dispatcher.BeginInvoke(
            System.Windows.Threading.DispatcherPriority.Normal, 
            new System.Action(function() {
                console.log("Running on UI thread");
                var mainWindow = System.Windows.Application.Current.Windows.get_Item(0);
                console.log("Found window #1: " + mainWindow);
                mainWindow.Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Colors.Red);
                mainWindow.MinWidth = 0;
                mainWindow.MinHeight = 0;
                
                console.log("[!] ### DONE ###");
        }));
    });
}, 1000);
console.log("[*] Init");