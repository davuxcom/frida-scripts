CLR.Init();
CLR.AddNamespace("System");
System.Reflection.Assembly.LoadWithPartialName("PresentationFramework");

function dump(addr) {
    return hexdump(addr, {
        offset: 0,
        length: 256,
        header: true,
        ansi: false
    });
}

var query_count = 0;

function SearchAsync(query) {
    
    if (query.length < 8)
    {
        console.log('[!] Query too short: ' + query);
        return;
    }
    
    query_count++;
    var my_query = query_count;
	var ranges = Process.enumerateRangesSync({protection: 'r--', coalesce: true});
    var range;
    function processNext(){
        range = ranges.pop();
        if(!range){
            console.log('[_] Done');
            return;
        }
        // due to the lack of blacklisting in Frida, there will be 
        // always an extra match of the given pattern (if found) because
        // the search is done also in the memory owned by Frida.
        Memory.scan(range.base, range.size, query, {
            onMatch: function(address, size){
                    console.log('Found at: ' + address.toString());
                    
                    if (my_query != query_count) 
                    {
                        console.log('Done (obsolete)');
                        return "stop";
                    }
                }, 
            onError: function(reason){
                    console.log('Error scanning memory');
                }, 
            onComplete: function(){
                    processNext();
                }
            });
    }
    processNext();
}

var uiThread = new System.Threading.Thread(new System.Threading.ThreadStart(function() {
    // Parse XAML compiled into a variable.
    var window = System.Windows.Markup.XamlReader.Parse(windowXaml);
    var Results = window.FindName("Results");
    var SearchBox = window.FindName("SearchBox");
    
    
    Results.Text = dump(Module.findExportByName("shell32.dll", "SHGetPropertyStoreForWindow"));

    SearchBox.TextChanged += new System.Windows.Controls.TextChangedEventHandler(function (s,e) {
        console.log("Text is: " + SearchBox.Text);
        
        SearchAsync(SearchBox.Text);
    });
    window.ShowDialog();
}));
uiThread.SetApartmentState(System.Threading.ApartmentState.STA);
uiThread.Start();