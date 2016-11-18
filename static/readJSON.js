/* jsonData have following "metadata" keys. ALso given is what is Critviz using
 "title": "Title of the graph",
 "primary-value-label": "rank average",
 "higher_primary_value_better": false,
 "values-label": "ranks",
 "higher_values_better": false,
 "y-range_top": 1,
 "y-range_bottom": 5.5,
 "y-axis-label": "Rank Average",
 "x-axis-label": "Students",
 "secondary-value-label": "variance, not in use right now, ignored",
 "values-range-low": 1,
 "values-range-high": 5,
 "number-of-colors": 5,
 "color-scheme": 1
 },
 */

/* jsonData have the following "data" keys for all students. Also given is what is Critviz using
 "first_name": "", empty in student view for other students
 "last_name": "", empty in student view for other students
 "column_url": "/assignments/737/responses/54715/showcrit?crit_assignment_id=744", url specifying the assignment
 "primary_value": 1.285714286, //rank average in critviz
 "secondary_value": 0.489795918, //variance in critviz, ignore
 "values": [1, 1, 1, 1, 1, 1, 3], //ranks in critviz
 */

function readJSON() {
    var rc;
    d3.json("dataFiles/mslip.json", function (data) {
        jsonData = data;

        rc = new RainbowGraph(data);

        /* sort by primary value
         if (rc.metadata['higher_primary_value_better']) {
         rc.jsonData[0].data.sort(function (a, b) {
         return parseFloat(b.primary_value) - parseFloat(a.primary_value);
         });
         }
         else {
         for (var i = 0; i < rc.jsonData[0].data.length; i++) {

         if (rc.jsonData[0].data[i].primary_value == 0) {

         rc.jsonData[0].data[i].primary_value = Number.MAX_SAFE_INTEGER;
         }
         }

         rc.jsonData[0].data.sort(function (a, b) {
         return parseFloat(a.primary_value) - parseFloat(b.primary_value);
         });
         }

         */
        rc.visualizeGraph();
    })
    return rc;
}