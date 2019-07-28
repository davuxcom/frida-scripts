# Script: Inject .net into Sonos desktop app

Work in progress.

Example for switching AppDomains.  The COM context is DefaultAppDomain, Sonos runs in WpfAppDomain so we need to switch and hand frida/js an interface to a COM object in the right AppDomain.