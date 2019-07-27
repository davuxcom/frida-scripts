"use strict";
const CLR = require('./dotnet');
const System = new CLR.Namespace("System");

// Simple solution to getting output from System.Diagnostics.Trace.WriteLine.
// Not optimal, but the alternative requires an assembly to load and inherit from TraceListener.
function CreateTraceListenerThread() {
    var tracingThread = new System.Threading.Thread(new System.Threading.ThreadStart(function () {
        var traceBuffer = System.Array.CreateInstance(System.Byte.$Clr_TypeOf(), 1024 * 1024 * 1024);
        CLR.Pin(traceBuffer);
        var write_ms = new System.IO.MemoryStream(traceBuffer, true);
        CLR.Pin(write_ms);
        System.Diagnostics.Trace.Listeners.Add(new System.Diagnostics.TextWriterTraceListener(write_ms));

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

module.exports = {
    EnableTraceListener: CreateTraceListenerThread,
};