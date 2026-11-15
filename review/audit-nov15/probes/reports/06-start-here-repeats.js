// RPT-06: when the IXL list runs onto more pages, the "Start here" box (data-keep) is copied onto every continued page.
// Runs probes/layout.js in its "many" mode (150 extra owed skills in Unit 3); exit 1 while any report prints Start here more than once.
process.argv[2] = 'many'; require('./layout.js');
