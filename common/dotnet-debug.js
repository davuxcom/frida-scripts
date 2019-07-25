"use strict";

// Simple solution to getting output from System.Diagnostics.Trace.WriteLine.

const CLR = require('./dotnet');
const System = CLR.GetNamespace("System");

module.exports = {
    EnableTraceListener: function () {
        
        var tracingThread = new System.Threading.Thread(new System.Threading.ThreadStart(function () {
            var traceBuffer = System.Array.CreateInstance(System.Byte.$Clr_TypeOf(), 1024 * 1024 * 1024); // TODO: can't threadsafe reset tho
            CLR.Pin(traceBuffer);
            var write_ms = new System.IO.MemoryStream(traceBuffer, true);
            CLR.Pin(write_ms);
            System.Diagnostics.Trace.Listeners.Add(new System.Diagnostics.TextWriterTraceListener(write_ms));
            // ThreadProc
            var last_write = 0;
            while (true) {
                System.Diagnostics.Trace.Flush();
                var newLength = write_ms.Position;
                if (last_write != newLength) {
                    var line = System.Text.Encoding.UTF8.GetString(traceBuffer, last_write, (newLength - last_write));
                    last_write = newLength;

                    var spl = line.split("\n")
                    for (var lx in spl) {
                        if (spl[lx]) { console.log("DotNet: " + spl[lx].trim()); }
                    }
                }
                System.Threading.Thread.Sleep(500);
            }
        }));
        tracingThread.Start();
    }
};