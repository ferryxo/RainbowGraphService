function RainbowGraph(data) {
    this.jsonData = data; //this variable will store all data read from json
    this.metadata = data[0].metadata;
    var svg, svg2;
    this.selected;
    this.inputColorScheme = "5a";
    this.brushCheck = false;
    this.hideLabels = false;
    this.colorKey = window.colorKey;
    this.rankings = [];
    this.allrankings = [];
    this.dropdown = null;
    this.min_rank_val = Number.MAX_SAFE_INTEGER;
    this.max_rank_val = 0;
    this.min_primary_val = Number.MAX_SAFE_INTEGER;
    this.max_primary_val = 0;
    this.duration = 1000;
    this.sas = [];
    this.crit_comparer = [];


}

RainbowGraph.prototype.parseData = function () {

    this.duration = Math.round (this.duration * this.jsonData[0].data.length / 45);

    //grab all score association data for crit comparer and sort the array

    this.useCritComparer = this.jsonData[0].metadata.crit_comparer=="yes"

    function sorter(a,b) {
        if (a.rank < b.rank)
            return -1;
        if (a.rank > b.rank)
            return 1;
        return 0;
    }

    //grab all score data
    var allrankingIndex = 0;
    for (var i = 0; i < this.jsonData[0].data.length; i++) {
        this.rankings[i] = []
        this.sas[i]= this.jsonData[0].data[i].sas;

        //get crit comparer data if they're available. Attach them to rankings[i]
        if(this.useCritComparer) {
            this.rankings[i].sorted_comparer = this.jsonData[0].data[i].critcomparer;
            this.rankings[i].sorted_comparer.sort(sorter);
        }

        for (var j = 0; j < this.jsonData[0].data[i].values.length; j++) {
            if(this.jsonData[0].data[i].values[j] == 0)
                continue;
            this.rankings[i].push(this.jsonData[0].data[i].values[j]);
            //rankings is a multidimensional array with rankings of each student
            var rank_val = new Object();
            rank_val.value = this.jsonData[0].data[i].values[j];  //allrankings is single dimensional array with rankings of each students in order
            rank_val.primary_value = this.jsonData[0].data[i].primary_value;
            rank_val.secondary_value = this.jsonData[0].data[i].secondary_value;
            rank_val.first_name = this.jsonData[0].data[i].first_name;
            rank_val.stu_id = this.jsonData[0].data[i].studentID;
            rank_val.x_pos = 0;
            //get crit comparer data if they're available. Attach them to the flatened allrankings[i]
            if(this.useCritComparer)
                rank_val.crit_comparer = this.rankings[i].sorted_comparer[j];

            this.allrankings[allrankingIndex] = rank_val

            if (this.min_rank_val > this.allrankings[allrankingIndex].value) {
                this.min_rank_val = this.allrankings[allrankingIndex.value];
            }
            if (this.max_rank_val < this.allrankings[allrankingIndex].value && this.allrankings[allrankingIndex].value != Number.MAX_SAFE_INTEGER) {
                this.max_rank_val = this.allrankings[allrankingIndex].value;
            }
            allrankingIndex++;
        }

        this.rankings[i].primary_value = this.jsonData[0].data[i].primary_value; //rank avg corresponds to primary value in json file for each student
        this.rankings[i].secondary_value = this.jsonData[0].data[i].secondary_value;
        this.rankings[i].first_name = this.jsonData[0].data[i].first_name;
        this.rankings[i].x_pos = 0;
        this.rankings[i].sas = this.jsonData[0].data[i].sas;
        this.rankings[i].stu_id = this.jsonData[0].data[i].studentID;

        if (this.min_primary_val > this.rankings[i].primary_value) {
            this.min_primary_val = Math.floor(this.rankings[i].primary_value);
        }
        if (this.max_primary_val < this.rankings[i].primary_value && this.rankings[i].primary_value != Number.MAX_SAFE_INTEGER) {
            this.max_primary_val = Math.ceil(this.rankings[i].primary_value);
        }
    }

    //if best & worst values are given in json, use them instead of the min and max in the data
    if (this.metadata["best-value-possible"] != undefined && this.metadata["worst-value-possible"] != undefined) {
        this.min_rank_val = Math.min(this.metadata["best-value-possible"], this.metadata["worst-value-possible"]);
        this.max_rank_val = Math.max(this.metadata["best-value-possible"], this.metadata["worst-value-possible"]);
    }

    if (this.metadata["worst-primary-value-possible"] != undefined && this.metadata["best-primary-value-possible"] != undefined) {
        this.max_primary_val = Math.min(this.metadata["best-primary-value-possible"], this.metadata["worst-primary-value-possible"]);
        this.max_primary_val = Math.max(this.metadata["best-primary-value-possible"], this.metadata["worst-primary-value-possible"]);
    }

}

RainbowGraph.prototype.buildChart = function () {

    var _this = this;
    rankScale = this.max_rank_val - this.min_rank_val + 1;
    higher_better =  _this.metadata['higher-primary-value-better']? true : false;
    var labels = "";

    if(this.svg!=null)
        d3.select("#svg").remove();

    //Note how all the dimensions are a percentage of the window size. This makes the visualization window size independent.
    //This is very important part of creating a responsive page.
    var margin = {
            top: 0.01 * window.innerHeight,
            right: 0.01 * window.innerWidth,
            bottom: 0.0, left: 0.05 * window.innerWidth
        },
        width = window.innerWidth * 0.9;

    height = (window.innerHeight * 0.6) - margin.top - margin.bottom;

    y = d3.scale.linear()
        .range([height, 0]);


    yAxis = d3.svg.axis()
        .scale(y)
        .innerTickSize(-width)
        .outerTickSize(0)
        .tickPadding(10)
        .orient("left");

    // if best-worst primary values are not defined, then take the min max from the data for the Y domain

    //flip the Y axis
    if (higher_better)
        y.domain([this.min_primary_val - 0.5, this.max_primary_val]);
    else
        y.domain([this.max_primary_val + 0.5, this.min_primary_val]);

    //If the user has not use brushing yet, this will make sure _this all the students are being shown in the main graph.
    if (this.brushCheck == false) {
        // If no student names are specified in the json file, d3 needs something unique on x-axis to plot the graph.
        // In _this case, it would be column_url. Also note _this we this.hideLabels as we dont want to show column_url in this case.

        x = d3.scale.ordinal()
            .rangeBands([0, width])
            .domain(_this.rankings.map(function (d, i){
                return i; //return only the index, as it has to be unique
            }));

        xAxis = d3.svg.axis()
            .scale(x)
            .tickFormat(function(i){ //relabel the x-axis
                d = _this.rankings[i];
                if (d.last_name != undefined && d.first_name != undefined )
                     return d.last_name + ', ' + d.first_name;
                else if (d.last_name != undefined)
                     return d.last_name
                else if (d.first_name != undefined)
                     return d.first_name
                else
                     return (d.column_url);
            })
            .orient("bottom");

    }

    this.svg = d3.select("body").append("svg")
        .attr("id", "svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom + 100)
        .append("g")
        .attr("transform", "translate(" + ( margin.left) + "," + (margin.top) + ")")

    var gx = this.svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis)
        .selectAll(".tick text")
        .attr("dx", -35)
        .attr("dy", -5)
        .attr("class", "stu_names")
        .attr("stu_id",function (d, i) {
            return (_this.rankings[i].stu_id );
        });

    gx.transition()
        .duration(this.duration)
        .attr("transform", "rotate(-90)")
        .call(xAxis)

    this.svg.append("g")
        .attr("class", "y axis")
        .call(yAxis)
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -36)
        .attr("x", -(height / 2))
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text(this.metadata['y-axis-label']);


    k = 0;
    allrankingIndex = 0;
    p2 = 0;
    p3 = 0;
    p4 = 0;
    p5 = 0;
    p6=0;
    t = 0;
    t2 = 0;
    t3 = 0;
    t4 = 0;
    t5 = 0;

    var tooltip = d3.select("body")
        .append("div")
        .style("position", "absolute")
        .style("z-index", "10")
        .style("visibility", "hidden");

    scoreBar = this.svg.selectAll(".scoreBar")
        .data(this.allrankings)
        .enter().append("rect")
        .attr("x", function (d, i) {
            t3++;
            if (t3 > _this.rankings[p3].length) {
                p3++;
                t3 = 1;
                //if no data available for this bar, skip to the next one
                if (_this.rankings[p3].length == 0) {
                    p3++;
                }
            }
            return _this.rankings[p3].x_pos;
        })
        .attr("width", function () {
            return width / _this.rankings.length
        })
        .attr("class", "s_rect")
        .attr("y", function (d, i) {
            t++;
            if (t > _this.rankings[allrankingIndex].length) {
                allrankingIndex++;
                t = 1;
                //if no data available for this bar, skip to the next one
                if (_this.rankings[allrankingIndex].length == 0) {
                    allrankingIndex++;

                }
            }

            return y(_this.rankings[allrankingIndex].primary_value) + (t - 1) * ((height - y(_this.rankings[allrankingIndex].primary_value)) / _this.rankings[allrankingIndex].length);
        })
        .attr("height", function (d, i) {
            t2++;
            if (t2 > _this.rankings[p2].length) {
                p2++;
                t2 = 1;
                if (_this.rankings[p2].length == 0) {
                    p2++;
                }
            }
            return (height - y(_this.rankings[p2].primary_value)) / _this.rankings[p2].length - 1
        })
        .attr("stu_id", function (d) { return d.stu_id;})
        .style("fill", function (d) {
            //determine if high score get first / last color
            color_index = (_this.metadata['best-value-possible'] > _this.metadata['worst-value-possible']) ? _this.metadata['best-value-possible'] - d.value : d.value - _this.metadata['best-value-possible'];
            //scale color in case, the available colors != the available ranking, we round the rating values to the nearest integer
            color_scale = _this.colorKey[_this.inputColorScheme].length / rankScale
            color_index = Math.round(color_index * _this.colorKey[_this.inputColorScheme].length / rankScale);
            color = _this.colorKey[_this.inputColorScheme][color_index];

            //this section is used for CPR data
            //it highlights the top most rectangle in the scoreBar (change the top most color to a lighter one)
            t5++;
            if (t5 > _this.rankings[p5].length) {
                p5++;
                t5 = 1;
            }

            if (_this.metadata["highlight-top-most-scoreBar"] && t5 == 1)
                color = _this.colorLuminance(color, 0.3)


            return color;
        })
        .style("z-index", "9")
        .attr("rx", 8)
        .attr("ry", 8)
        .on("mouseover", function (d) {
            if(_this.useCritComparer)
                showReviewerDataOnMouseOver.call(this);

            tooltip.text(_this.metadata["values-label"] + ":" + d.value + ", " + (_this.metadata["secondary-value-label"] + ":" + d.secondary_value.toFixed(2)));
            tooltip.style("visibility", "visible");

            //TODO: highlight the reviewer
        })
        .on("mouseout", function (d, i) {
            if(_this.useCritComparer)
                hideReviewerDataOnMouseLeave();

            this.style.fill = this.original_color
            return tooltip.style("visibility", "hidden");

        })
        .on("mousemove", function (d, i) {
            tooltip.style("top", (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 10) + "px");
        })

    if(this.useCritComparer)
        scoreBar.attr("crit_comp",function(d, i){
                prep = d.crit_comparer.criticID + "|" + d.crit_comparer.critpeers;
                return (prep);
        })

    function showReviewerDataOnMouseOver() {
        var radius = 7
        crit_data = this.getAttribute("crit_comp").split("|");
        stags = document.getElementsByClassName("s_rect");
        sas_tags = document.getElementsByClassName("sas");
        critpeers = crit_data[1].split(",");

        for (ih = 0; ih < stags.length; ih++) {
            stags[ih].style.opacity = 0.3;
        }

        for (is = 0; is < sas_tags.length; is++) {
            sas_tags[is].style.opacity = 0.3;
        }

        for (ih = 0; ih < stags.length; ih++) {
            if (parseInt(stags[ih].getAttribute("stu_id")) == crit_data[0]) {
                //console.log("found reviewer in stags: " + stags[ih].getAttribute("stu_id"))
                stags[ih].style.opacity = 1; //uncomment this to highlight the reviewer ranks
                var circleSelection = _this.svg.append("circle")
                    .attr("cx", function () {
                        return parseFloat(stags[ih].getAttribute("x")) + parseFloat(stags[ih].getAttribute("width"))/2 ;
                    })
                    .attr("cy", .6 * window.innerHeight)
                    .attr("r", radius)
                    .attr("class", "s_circle")
                    .style("fill", "purple")
                    .style("stroke", "white")
                    .style("stroke-width", ".5");
            }
        }

        peer_cnt = 0;
        while (peer_cnt < critpeers.length) {
            ih = 0;
            stags = document.getElementsByClassName("s_rect");
            for (ih = 0; ih < stags.length; ih++) {
                if (parseInt(stags[ih].getAttribute("stu_id")) == critpeers[peer_cnt]) {
                    //console.log("found peer in stags: " + stags[ih].getAttribute("stu_id"))
                    peer_crit_data = stags[ih].getAttribute("crit_comp").split("|");
                    criticpeers = peer_crit_data[0];
                    if (criticpeers == crit_data[0]) {
                        stags[ih].style.opacity = 1;
                        var circleSelection = _this.svg.append("circle")
                            .attr("cx", function () {
                                return parseFloat(stags[ih].getAttribute("x")) + parseFloat(stags[ih].getAttribute("width"))/2 ;
                            })
                            .attr("cy", .6 * window.innerHeight)
                            .attr("r", radius)
                            .attr("class", "s_circle")
                            .style("fill", "blue")
                            .style("stroke", "white")
                            .style("stroke-width", ".5");
                    }
                }
            }
            ++peer_cnt;
        }
    }

    function hideReviewerDataOnMouseLeave() {
        var s = d3.selectAll('.s_circle');
        s = s.remove();
        sas_tags = document.getElementsByClassName("sas");
        stags = document.getElementsByClassName("s_rect");
        for (is = 0; is < sas_tags.length; is++) {
            sas_tags[is].style.opacity = 1;
        }

        for (ih = 0; ih < stags.length; ih++) {
            chech_stroke = stags[ih].getAttribute("style").split(";");
            stags[ih].style.opacity = 1;
            if (chech_stroke.length == 3) {
                stags[ih].style.stroke = "null"
            }
        }
    }

    p6=0;
    t6=0
    scoreBar.transition()
        .duration(this.duration)
        .attr("x", function (d, i) {
            t6++;
            if (t6 > _this.rankings[p6].length) {
                p6++;
                t6 = 1;
                //if no data available for this bar, skip to the next one
                if (_this.rankings[p6].length == 0) {
                    p6++;
                }
            }
            _this.rankings[p6].x_pos = ((width / _this.rankings.length) * (p6))
            return ((width / _this.rankings.length) * (p6));
        })

    //self assessment bars
    allrankingIndex=0;
    min=0;

    sasBodyBar = this.svg.selectAll(".sasBodyBar")
        .data(this.rankings)
        .enter().append("rect")
        .attr("x", function (d, i) {
            return ((width / _this.rankings.length) * (i));
        })
        .attr("width", function () {
            return width / _this.rankings.length
        })
        .attr("y", function (d, i) {
            //move this below the top bar by 8px so that the top bar looks round
            return y(_this.rankings[i].sas) + 8;
        })
        .attr("height", function (d, i) {
            //set the starting value for the grey box to the primary val, unless it's 0 then start where the Y-axis starts.
            min = (_this.rankings[i].primary_value == 0 ? _this.rankings[i].primary_value - (0.5 * higher_better) : _this.rankings[i].primary_value);
            //compensate the top of the bar that is moved down a little bit so the top bar looks rounded
            min = min + (higher_better ? 0.05 : -0.05)
            if(higher_better){
                if(_this.rankings[i].sas > min){
                    return (y(min) - y(_this.rankings[i].sas) )
                }else{

                    return (0);function RainbowGraph(data) {
                        this.jsonData = data; //this variable will store all data read from json
                        this.metadata = data[0].metadata;
                        var svg, svg2;
                        this.selected;
                        this.inputColorScheme = "5a";
                        this.brushCheck = false;
                        this.hideLabels = false;
                        this.colorKey = window.colorKey;
                        this.rankings = [];
                        this.allrankings = [];
                        this.dropdown = null;
                        this.min_rank_val = Number.MAX_SAFE_INTEGER;
                        this.max_rank_val = 0;
                        this.min_primary_val = Number.MAX_SAFE_INTEGER;
                        this.max_primary_val = 0;
                        this.duration = 1000;
                        this.sas = [];
                        this.crit_comparer = [];


                    }

                    RainbowGraph.prototype.parseData = function () {

                        this.duration = Math.round (this.duration * this.jsonData[0].data.length / 45);

                        //grab all score association data for crit comparer and sort the array

                        this.useCritComparer = this.jsonData[0].metadata.crit_comparer=="yes"

                        function sorter(a,b) {
                            if (a.rank < b.rank)
                                return -1;
                            if (a.rank > b.rank)
                                return 1;
                            return 0;
                        }
                        /*
                         var c_cnt=0;
                         if(this.useCritComparer) {
                         compIndex=0;
                         for (var c_cnt = 0; c_cnt < this.jsonData[0].data.length; c_cnt++){
                         //t_array =this.jsonData[0].data[c_cnt].values;
                         sorted_comparer=this.jsonData[0].data[c_cnt].critcomparer;
                         sorted_comparer.sort(sorter);
                         for(var k=0; k<sorted_comparer.length; k++){
                         if(sorted_comparer[k].rank==0){
                         continue;
                         }
                         this.crit_comparer[compIndex] = sorted_comparer[k];
                         ++compIndex;
                         }
                         }
                         }*/

                        //grab all score data
                        var allrankingIndex = 0;
                        for (var i = 0; i < this.jsonData[0].data.length; i++) {
                            this.rankings[i] = []
                            this.sas[i]= this.jsonData[0].data[i].sas;

                            //get crit comparer data if they're available. Attach them to rankings[i]
                            if(this.useCritComparer) {
                                this.rankings[i].sorted_comparer = this.jsonData[0].data[i].critcomparer;
                                this.rankings[i].sorted_comparer.sort(sorter);
                            }

                            for (var j = 0; j < this.jsonData[0].data[i].values.length; j++) {
                                if(this.jsonData[0].data[i].values[j] == 0)
                                    continue;
                                this.rankings[i].push(this.jsonData[0].data[i].values[j]);
                                //rankings is a multidimensional array with rankings of each student
                                var rank_val = new Object();
                                rank_val.value = this.jsonData[0].data[i].values[j];  //allrankings is single dimensional array with rankings of each students in order
                                rank_val.primary_value = this.jsonData[0].data[i].primary_value;
                                rank_val.secondary_value = this.jsonData[0].data[i].secondary_value;
                                rank_val.first_name = this.jsonData[0].data[i].first_name;
                                rank_val.stu_id = this.jsonData[0].data[i].studentID;
                                rank_val.x_pos = 0;
                                //get crit comparer data if they're available. Attach them to the flatened allrankings[i]
                                if(this.useCritComparer)
                                    rank_val.crit_comparer = this.rankings[i].sorted_comparer[j];

                                this.allrankings[allrankingIndex] = rank_val

                                if (this.min_rank_val > this.allrankings[allrankingIndex].value) {
                                    this.min_rank_val = this.allrankings[allrankingIndex.value];
                                }
                                if (this.max_rank_val < this.allrankings[allrankingIndex].value && this.allrankings[allrankingIndex].value != Number.MAX_SAFE_INTEGER) {
                                    this.max_rank_val = this.allrankings[allrankingIndex].value;
                                }
                                allrankingIndex++;
                            }

                            this.rankings[i].primary_value = this.jsonData[0].data[i].primary_value; //rank avg corresponds to primary value in json file for each student
                            this.rankings[i].secondary_value = this.jsonData[0].data[i].secondary_value;
                            this.rankings[i].first_name = this.jsonData[0].data[i].first_name;
                            this.rankings[i].x_pos = 0;
                            this.rankings[i].sas = this.jsonData[0].data[i].sas;
                            this.rankings[i].stu_id = this.jsonData[0].data[i].studentID;

                            if (this.min_primary_val > this.rankings[i].primary_value) {
                                this.min_primary_val = Math.floor(this.rankings[i].primary_value);
                            }
                            if (this.max_primary_val < this.rankings[i].primary_value && this.rankings[i].primary_value != Number.MAX_SAFE_INTEGER) {
                                this.max_primary_val = Math.ceil(this.rankings[i].primary_value);
                            }
                        }

                        //if best & worst values are given in json, use them instead of the min and max in the data
                        if (this.metadata["best-value-possible"] != undefined && this.metadata["worst-value-possible"] != undefined) {
                            this.min_rank_val = Math.min(this.metadata["best-value-possible"], this.metadata["worst-value-possible"]);
                            this.max_rank_val = Math.max(this.metadata["best-value-possible"], this.metadata["worst-value-possible"]);
                        }

                        if (this.metadata["worst-primary-value-possible"] != undefined && this.metadata["best-primary-value-possible"] != undefined) {
                            this.max_primary_val = Math.min(this.metadata["best-primary-value-possible"], this.metadata["worst-primary-value-possible"]);
                            this.max_primary_val = Math.max(this.metadata["best-primary-value-possible"], this.metadata["worst-primary-value-possible"]);
                        }

                    }

                    RainbowGraph.prototype.buildChart = function () {

                        var _this = this;
                        rankScale = this.max_rank_val - this.min_rank_val + 1;
                        higher_better =  _this.metadata['higher-primary-value-better']? true : false;
                        var labels = "";

                        if(this.svg!=null)
                            d3.select("#svg").remove();

                        //Note how all the dimensions are a percentage of the window size. This makes the visualization window size independent.
                        //This is very important part of creating a responsive page.
                        var margin = {
                                top: 0.01 * window.innerHeight,
                                right: 0.01 * window.innerWidth,
                                bottom: 0.0, left: 0.05 * window.innerWidth
                            },
                            width = window.innerWidth * 0.9;

                        height = (window.innerHeight * 0.6) - margin.top - margin.bottom;

                        y = d3.scale.linear()
                            .range([height, 0]);


                        yAxis = d3.svg.axis()
                            .scale(y)
                            .innerTickSize(-width)
                            .outerTickSize(0)
                            .tickPadding(10)
                            .orient("left");

                        // if best-worst primary values are not defined, then take the min max from the data for the Y domain

                        //flip the Y axis
                        if (higher_better)
                            y.domain([this.min_primary_val - 0.5, this.max_primary_val]);
                        else
                            y.domain([this.max_primary_val + 0.5, this.min_primary_val]);

                        //If the user has not use brushing yet, this will make sure _this all the students are being shown in the main graph.
                        if (this.brushCheck == false) {
                            x = d3.scale.ordinal()
                                .rangeBands([0, width]);

                            xAxis = d3.svg.axis()
                                .scale(x)
                                .orient("bottom");

                            // If no student names are specified in the json file, d3 needs something unique on x-axis to plot the graph.
                            // In _this case, it would be column_url. Also note _this we this.hideLabels as we dont want to show column_url in this case.
                            //TODO: Why does it not require column_url in return statement. It still works if it does not return.
                            x.domain(this.rankings.map(function (d, i) {
                                if (d.last_name != undefined && d.first_name != undefined )
                                    return d.last_name + ', ' + d.first_name;
                                if (d.last_name != undefined)
                                    return d.last_name
                                if (d.first_name != undefined)
                                    return d.first_name
                                else
                                    return (d.column_url);
                            }));
                        }

                        this.svg = d3.select("body").append("svg")
                            .attr("id", "svg")
                            .attr("width", width + margin.left + margin.right)
                            .attr("height", height + margin.top + margin.bottom + 100)
                            .append("g")
                            .attr("transform", "translate(" + ( margin.left) + "," + (margin.top) + ")")

                        var gx = this.svg.append("g")
                            .attr("class", "x axis")
                            .attr("transform", "translate(0," + height + ")")
                            .call(xAxis)
                            .selectAll(".tick text")
                            .attr("dx", -35)
                            .attr("dy", -5)
                            .attr("class", "stu_names")
                            .attr("stu_id",function (d, i) {
                                return (_this.rankings[i].stu_id );
                            });

                        gx.transition()
                            .duration(this.duration)
                            .attr("transform", "rotate(-90)")
                            .call(xAxis)

                        this.svg.append("g")
                            .attr("class", "y axis")
                            .call(yAxis)
                            .append("text")
                            .attr("transform", "rotate(-90)")
                            .attr("y", -36)
                            .attr("x", -(height / 2))
                            .attr("dy", ".71em")
                            .style("text-anchor", "end")
                            .text(this.metadata['y-axis-label']);


                        k = 0;
                        allrankingIndex = 0;
                        p2 = 0;
                        p3 = 0;
                        p4 = 0;
                        p5 = 0;
                        p6=0;
                        t = 0;
                        t2 = 0;
                        t3 = 0;
                        t4 = 0;
                        t5 = 0;

                        var tooltip = d3.select("body")
                            .append("div")
                            .style("position", "absolute")
                            .style("z-index", "10")
                            .style("visibility", "hidden");

                        scoreBar = this.svg.selectAll(".scoreBar")
                            .data(this.allrankings)
                            .enter().append("rect")
                            .attr("x", function (d, i) {
                                t3++;
                                if (t3 > _this.rankings[p3].length) {
                                    p3++;
                                    t3 = 1;
                                    //if no data available for this bar, skip to the next one
                                    if (_this.rankings[p3].length == 0) {
                                        p3++;
                                    }
                                }
                                return _this.rankings[p3].x_pos;
                            })
                            .attr("width", function () {
                                return width / _this.rankings.length
                            })
                            .attr("class", "s_rect")
                            .attr("y", function (d, i) {
                                t++;
                                if (t > _this.rankings[allrankingIndex].length) {
                                    allrankingIndex++;
                                    t = 1;
                                    //if no data available for this bar, skip to the next one
                                    if (_this.rankings[allrankingIndex].length == 0) {
                                        allrankingIndex++;

                                    }
                                }

                                return y(_this.rankings[allrankingIndex].primary_value) + (t - 1) * ((height - y(_this.rankings[allrankingIndex].primary_value)) / _this.rankings[allrankingIndex].length);
                            })
                            .attr("height", function (d, i) {
                                t2++;
                                if (t2 > _this.rankings[p2].length) {
                                    p2++;
                                    t2 = 1;
                                    if (_this.rankings[p2].length == 0) {
                                        p2++;
                                    }
                                }
                                return (height - y(_this.rankings[p2].primary_value)) / _this.rankings[p2].length - 1
                            })
                            .attr("stu_id", function (d) { return d.stu_id;})
                            .style("fill", function (d) {
                                //determine if high score get first / last color
                                color_index = (_this.metadata['best-value-possible'] > _this.metadata['worst-value-possible']) ? _this.metadata['best-value-possible'] - d.value : d.value - _this.metadata['best-value-possible'];
                                //scale color in case, the available colors != the available ranking, we round the rating values to the nearest integer
                                color_scale = _this.colorKey[_this.inputColorScheme].length / rankScale
                                color_index = Math.round(color_index * _this.colorKey[_this.inputColorScheme].length / rankScale);
                                color = _this.colorKey[_this.inputColorScheme][color_index];

                                //this section is used for CPR data
                                //it highlights the top most rectangle in the scoreBar (change the top most color to a lighter one)
                                t5++;
                                if (t5 > _this.rankings[p5].length) {
                                    p5++;
                                    t5 = 1;
                                }

                                if (_this.metadata["highlight-top-most-scoreBar"] && t5 == 1)
                                    color = _this.colorLuminance(color, 0.3)


                                return color;
                            })
                            .style("z-index", "9")
                            .attr("rx", 8)
                            .attr("ry", 8)
                            .on("mouseover", function (d) {
                                if(_this.useCritComparer)
                                    showReviewerDataOnMouseOver.call(this);

                                tooltip.text(_this.metadata["values-label"] + ":" + d.value + ", " + (_this.metadata["secondary-value-label"] + ":" + d.secondary_value.toFixed(2)));
                                tooltip.style("visibility", "visible");

                                //TODO: highlight the reviewer
                            })
                            .on("mouseout", function (d, i) {
                                if(_this.useCritComparer)
                                    hideReviewerDataOnMouseLeave();

                                this.style.fill = this.original_color
                                return tooltip.style("visibility", "hidden");

                            })
                            .on("mousemove", function (d, i) {
                                tooltip.style("top", (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 10) + "px");
                            })

                        if(this.useCritComparer)
                            scoreBar.attr("crit_comp",function(d, i){
                                prep = d.crit_comparer.criticID + "|" + d.crit_comparer.critpeers;
                                return (prep);
                            })

                        function showReviewerDataOnMouseOver() {
                            crit_data = this.getAttribute("crit_comp").split("|");
                            stags = document.getElementsByClassName("s_rect");
                            sas_tags = document.getElementsByClassName("sas");
                            critpeers = crit_data[1].split(",");

                            for (ih = 0; ih < stags.length; ih++) {
                                stags[ih].style.opacity = 0.3;
                            }

                            for (is = 0; is < sas_tags.length; is++) {
                                sas_tags[is].style.opacity = 0.3;
                            }

                            for (ih = 0; ih < stags.length; ih++) {
                                if (parseInt(stags[ih].getAttribute("stu_id")) == crit_data[0]) {
                                    //console.log("found reviewer in stags: " + stags[ih].getAttribute("stu_id"))
                                    var circleSelection = _this.svg.append("circle")
                                        .attr("cx", function () {
                                            var tem = parseFloat(stags[ih].getAttribute("x")) + parseFloat(13.0);
                                            return tem;
                                        })
                                        .attr("cy", .6 * window.innerHeight)
                                        .attr("r", 5)
                                        .attr("class", "s_circle")
                                        .style("fill", "red");
                                }
                            }

                            peer_cnt = 0;
                            while (peer_cnt < critpeers.length) {
                                ih = 0;
                                stags = document.getElementsByClassName("s_rect");
                                for (ih = 0; ih < stags.length; ih++) {
                                    if (parseInt(stags[ih].getAttribute("stu_id")) == critpeers[peer_cnt]) {
                                        //console.log("found peer in stags: " + stags[ih].getAttribute("stu_id"))
                                        peer_crit_data = stags[ih].getAttribute("crit_comp").split("|");
                                        criticpeers = peer_crit_data[0];
                                        if (criticpeers == crit_data[0]) {
                                            stags[ih].style.opacity = 1;
                                            var circleSelection = _this.svg.append("circle")
                                                .attr("cx", function () {
                                                    var tem = parseFloat(stags[ih].getAttribute("x")) + parseFloat(13.0);
                                                    return tem;
                                                })
                                                .attr("cy", .6 * window.innerHeight)
                                                .attr("r", 5)
                                                .attr("class", "s_circle")
                                                .style("fill", "green");
                                        }
                                    }
                                }
                                ++peer_cnt;
                            }
                        }

                        function hideReviewerDataOnMouseLeave() {
                            var s = d3.selectAll('.s_circle');
                            s = s.remove();
                            sas_tags = document.getElementsByClassName("sas");
                            stags = document.getElementsByClassName("s_rect");
                            for (is = 0; is < sas_tags.length; is++) {
                                sas_tags[is].style.opacity = 1;
                            }

                            for (ih = 0; ih < stags.length; ih++) {
                                chech_stroke = stags[ih].getAttribute("style").split(";");
                                stags[ih].style.opacity = 1;
                                if (chech_stroke.length == 3) {
                                    stags[ih].style.stroke = "null"
                                }
                            }
                        }

                        p6=0;
                        t6=0
                        scoreBar.transition()
                            .duration(this.duration)
                            .attr("x", function (d, i) {
                                t6++;
                                if (t6 > _this.rankings[p6].length) {
                                    p6++;
                                    t6 = 1;
                                    //if no data available for this bar, skip to the next one
                                    if (_this.rankings[p6].length == 0) {
                                        p6++;
                                    }
                                }
                                _this.rankings[p6].x_pos = ((width / _this.rankings.length) * (p6))
                                return ((width / _this.rankings.length) * (p6));
                            })

                        //self assessment bars
                        allrankingIndex=0;
                        min=0;

                        sasBodyBar = this.svg.selectAll(".sasBodyBar")
                            .data(this.rankings)
                            .enter().append("rect")
                            .attr("x", function (d, i) {
                                return ((width / _this.rankings.length) * (i));
                            })
                            .attr("width", function () {
                                return width / _this.rankings.length
                            })
                            .attr("y", function (d, i) {
                                return y(_this.rankings[i].sas) + 8;
                            })
                            .attr("height", function (d, i) {
                                //set the starting value for the grey box to the primary val, unless it's 0 then start where the Y-axis starts.
                                min = (_this.rankings[i].primary_value == 0 ? _this.rankings[i].primary_value - (0.5 * higher_better) : _this.rankings[i].primary_value);
                                //compensate the top of the bar that is moved down a little bit so the top bar looks rounded
                                min = min + (higher_better ? 0.05 : -0.05)
                                if(higher_better){
                                    if(_this.rankings[i].sas > min){
                                        return (y(min) - y(_this.rankings[i].sas) )
                                    }else{

                                        return (0);
                                    }
                                }else{
                                    if(_this.rankings[i].sas < min){
                                        return (y(min) -y(_this.rankings[i].sas))
                                    }else{

                                        return (0);
                                    }
                                }
                            })
                            .style("fill", "black")
                            .style("stroke", "red")
                            .style("stroke-width", ".5")
                            .style("opacity", 0.3)
                            .style("z-index", "7")
                            .on("mouseover", function (d) {

                                this.original_color = this.style.fill;
                                this.style.fill = "gray"
                                tooltip.text("self-assessement" + ":" + d.sas );
                                tooltip.style("visibility", "visible");

                                //TODO: highlight the reviewer
                            })
                            .on("mouseout", function (d, i) {
                                this.style.fill = this.original_color
                                return tooltip.style("visibility", "hidden");
                            })
                            .on("mousemove", function (d, i) {
                                tooltip.style("top", (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 10) + "px");
                            })



                        sasBodyBar.transition()
                            .duration(this.duration)
                            .attr("x", function (d, i) {
                                return ((width / _this.rankings.length) * (i));
                            })


                        sasTopBar = this.svg.selectAll(".sasTopBar")
                            .data(this.rankings)
                            .enter().append("rect")
                            .attr("x", function (d, i) {
                                return ((width / _this.rankings.length) * (i));
                            })
                            .attr("width", function () {
                                return width / _this.rankings.length
                            })
                            .attr("y", function (d, i) {
                                return y(_this.rankings[i].sas);
                            })
                            .attr("height", function (d, i) {
                                return 15;
                            })
                            .attr("class", "sas")
                            .style("fill", function(d, i){
                                return "#373737"
                            })
                            .style("stroke", "white")
                            .style("stroke-width", ".5")
                            .style("opacity", 1)
                            .style("z-index", "8")
                            .attr("rx", 8)
                            .attr("ry", 8)
                            .on("mouseover", function (d) {
                                this.original_color = this.style.fill;
                                this.style.fill = "gray"
                                tooltip.text("self-assessement" + ":" + d.sas );
                                tooltip.style("visibility", "visible");

                            })
                            .on("mouseout", function (d, i) {
                                this.style.fill = this.original_color
                                return tooltip.style("visibility", "hidden");
                            })
                            .on("mousemove", function (d, i) {
                                tooltip.style("top", (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 10) + "px");
                            })



                        p6=-1;
                        t6=0
                        t3=0
                        sasTopBar.transition()
                            .duration(this.duration)
                            .attr("x", function (d, i) {
                                ++p6;
                                return ((width / _this.rankings.length) * (p6));
                            })


                        this.svg.select("g")
                            .selectAll(".tick")
                            .filter(function (d) {

                            })  //this is a temporary logic. If our x axis parameter is other than url, then this will change.
                            .remove();

                    };

//this.hideLabels are used to indicate if student names should be hidden in x axis or not.
                    RainbowGraph.prototype.visualizeGraph = function(){
                        var _this = this;

                        this.parseData();

                        this.inputColorScheme=this.metadata["color-scheme"];

                        if(document.getElementById("title")!=undefined)
                            document.getElementById("title").innerHTML = this.metadata.title;

                        if(this.dropdown!=null)
                            d3.select('body')
                                .selectAll('allrankingIndex')
                                .remove();

                        this.dropdown = d3.select('body')
                            .append('allrankingIndex')
                            .text('Sort by ')
                            .attr('class','right-align')
                            .append('select')
                            .style('right-margin', '10px')
                            .on('change', function(){
                                _this.onSortByChange(_this)
                            });

                        var options = this.dropdown
                            .selectAll('option')
                            .data([this.metadata["primary-value-label"], this.metadata["secondary-value-label"], this.metadata["x-axis-label"]]).enter()
                            .append('option')
                            .text(function (d) { return d; });

                        this.buildChart();

                    };

                    RainbowGraph.prototype.onSortByChange = function(obj) {

                        var _this = obj;
                        higher_better =  _this.metadata['higher-primary-value-better']? 1 : -1

                        selectValue = d3.select('select').property('value');

                        //sort rankings
                        _this.rankings.sort(function(a, b) {
                            if(selectValue == _this.metadata["x-axis-label"]){
                                if(a.first_name != "" )
                                    return a.first_name.toLowerCase().localeCompare( b.first_name.toLowerCase());
                                else if (a.first_name == "" && b.first_name == "")
                                    return 0;
                            }else if(selectValue == _this.metadata["primary-value-label"]) {
                                if( a.primary_value > b.primary_value ) return -higher_better
                                else if ( a.primary_value < b.primary_value ) return higher_better
                            }else if(selectValue == _this.metadata["secondary-value-label"]) {
                                if( a.secondary_value > b.secondary_value ) return -higher_better
                                else if ( a.secondary_value < b.secondary_value ) return higher_better
                            }
                            return 0;
                        });

                        //flaten rankings after it's sorted
                        allrankingIndex=0;
                        for (var i = 0; i < _this.rankings.length; i++) {
                            for (var j = 0; j < _this.rankings[i].length; j++) {
                                var rank_val = new Object();
                                rank_val.value = _this.rankings[i][j];  //allrankings is single dimensional array with rankings of each students in order
                                rank_val.primary_value = _this.rankings[i].primary_value;
                                rank_val.secondary_value = _this.rankings[i].secondary_value;
                                rank_val.first_name = _this.rankings[i].first_name;
                                rank_val.x_pos = _this.rankings[i].x_pos;
                                rank_val.sas = _this.rankings[i].sas;
                                rank_val.stu_id = _this.rankings[i].stu_id;
                                if(_this.useCritComparer)
                                    rank_val.crit_comparer = _this.rankings[i].sorted_comparer[j];
                                this.allrankings[allrankingIndex] = rank_val
                                allrankingIndex++;
                            }
                        }

                        this.buildChart();

                    };

                    RainbowGraph.prototype.type = function(d) {
                        d.primary_value = +d.primary_value;
                        return d;
                    };

//calculate the lighter / darker color based on it's luminance
                    RainbowGraph.prototype.colorLuminance = function(hex, lum) {

                        // validate hex string
                        hex = String(hex).replace(/[^0-9a-f]/gi, '');
                        if (hex.length < 6) {
                            hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
                        }
                        lum = lum || 0;

                        // convert to decimal and change luminosity
                        var rgb = "#", c, i;
                        for (i = 0; i < 3; i++) {
                            c = parseInt(hex.substr(i*2,2), 16);
                            c = Math.round(Math.min(Math.max(0, c + (c * lum)), 255)).toString(16);
                            rgb += ("00"+c).substr(c.length);
                        }

                        return rgb;
                    };

                }
            }else{
                if(_this.rankings[i].sas < min){
                        return (y(min) -y(_this.rankings[i].sas))
                }else{

                    return (0);
                }
            }
        })
        .style("fill", "6d6d6d")
        .style("stroke", "red")
        .style("stroke-width", ".5")
        .style("opacity", 0.2)
        .style("z-index", "7")
        .on("mouseover", function (d) {

            this.original_color = this.style.fill;
            this.style.fill = "gray"
            tooltip.text("self-assessement" + ":" + d.sas );
            tooltip.style("visibility", "visible");

            //TODO: highlight the reviewer
        })
        .on("mouseout", function (d, i) {
            this.style.fill = this.original_color
            return tooltip.style("visibility", "hidden");
        })
        .on("mousemove", function (d, i) {
            tooltip.style("top", (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 10) + "px");
        })



    sasBodyBar.transition()
        .duration(this.duration)
        .attr("x", function (d, i) {
          return ((width / _this.rankings.length) * (i));
        })


   sasTopBar = this.svg.selectAll(".sasTopBar")
        .data(this.rankings)
        .enter().append("rect")
        .attr("x", function (d, i) {
          return ((width / _this.rankings.length) * (i));
        })
        .attr("width", function () {
            return width / _this.rankings.length
        })
        .attr("y", function (d, i) {
            return y(_this.rankings[i].sas);
        })
        .attr("height", function (d, i) {
            return 15;
        })
        .attr("class", "sas")
        .style("fill", function(d, i){
                return "#3f3f3f"
        })
        .style("stroke", "white")
        .style("stroke-width", "1")
        .style("opacity", 1)
        .style("z-index", "8")
        .attr("rx", 8)
        .attr("ry", 8)
        .on("mouseover", function (d) {

            this.original_color = this.style.fill;
            this.style.fill = "gray"
            tooltip.text("self-assessement" + ":" + d.sas );
            tooltip.style("visibility", "visible");

        })
        .on("mouseout", function (d, i) {
            this.style.fill = this.original_color
            return tooltip.style("visibility", "hidden");
        })
        .on("mousemove", function (d, i) {
            tooltip.style("top", (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 10) + "px");
        })



    p6=-1;
    t6=0
    t3=0
    sasTopBar.transition()
        .duration(this.duration)
        .attr("x", function (d, i) {
        ++p6;
          return ((width / _this.rankings.length) * (p6));
        })


    this.svg.select("g")
        .selectAll(".tick")
        .filter(function (d) {

        })  //this is a temporary logic. If our x axis parameter is other than url, then this will change.
        .remove();

};

//this.hideLabels are used to indicate if student names should be hidden in x axis or not.
RainbowGraph.prototype.visualizeGraph = function(){
    var _this = this;

    this.parseData();

    this.inputColorScheme=this.metadata["color-scheme"];

    if(document.getElementById("title")!=undefined)
        document.getElementById("title").innerHTML = this.metadata.title;

    if(this.dropdown!=null)
        d3.select('body')
            .selectAll('allrankingIndex')
            .remove();

    this.dropdown = d3.select('body')
        .append('allrankingIndex')
        .text('Sort by ')
        .attr('class','right-align')
        .append('select')
        .style('right-margin', '10px')
        .on('change', function(){
            _this.onSortByChange(_this)
        });

    var options = this.dropdown
        .selectAll('option')
        .data([this.metadata["primary-value-label"], this.metadata["secondary-value-label"], this.metadata["x-axis-label"]]).enter()
        .append('option')
        .text(function (d) { return d; });

    this.buildChart();

};

RainbowGraph.prototype.onSortByChange = function(obj) {

    var _this = obj;
    higher_better =  _this.metadata['higher-primary-value-better']? 1 : -1

    selectValue = d3.select('select').property('value');

    //sort rankings
    _this.rankings.sort(function(a, b) {
        if(selectValue == _this.metadata["x-axis-label"]){
            if(a.last_name != undefined )
                return a.last_name.toLowerCase().localeCompare( b.last_name.toLowerCase());
            else if (a.first_name != undefined)
                return a.first_name.toLowerCase().localeCompare( b.first_name.toLowerCase());
        }else if(selectValue == _this.metadata["primary-value-label"]) {
            if( a.secondary_value != undefined && b.secondary_value != undefined)
                if( a.primary_value > b.primary_value )
                    return -higher_better
                else if ( a.primary_value < b.primary_value )
                    return higher_better
        }else if(selectValue == _this.metadata["secondary-value-label"]) {
            if( a.secondary_value != undefined && b.secondary_value != undefined)
                if( a.secondary_value > b.secondary_value )
                    return -higher_better
                else if ( a.secondary_value < b.secondary_value )
                    return higher_better
        }
        return 0;
    });

    //flaten rankings after it's sorted
    allrankingIndex=0;
    for (var i = 0; i < _this.rankings.length; i++) {
        for (var j = 0; j < _this.rankings[i].length; j++) {
            var rank_val = new Object();
            rank_val.value = _this.rankings[i][j];  //allrankings is single dimensional array with rankings of each students in order
            rank_val.primary_value = _this.rankings[i].primary_value;
            rank_val.secondary_value = _this.rankings[i].secondary_value;
            rank_val.first_name = _this.rankings[i].first_name;
            rank_val.x_pos = _this.rankings[i].x_pos;
            rank_val.sas = _this.rankings[i].sas;
            rank_val.stu_id = _this.rankings[i].stu_id;
            if(_this.useCritComparer)
                rank_val.crit_comparer = _this.rankings[i].sorted_comparer[j];
            this.allrankings[allrankingIndex] = rank_val
            allrankingIndex++;
        }
    }

    this.buildChart();

};

RainbowGraph.prototype.type = function(d) {
    d.primary_value = +d.primary_value;
    return d;
};

//calculate the lighter / darker color based on it's luminance
RainbowGraph.prototype.colorLuminance = function(hex, lum) {

    // validate hex string
    hex = String(hex).replace(/[^0-9a-f]/gi, '');
    if (hex.length < 6) {
        hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    }
    lum = lum || 0;

    // convert to decimal and change luminosity
    var rgb = "#", c, i;
    for (i = 0; i < 3; i++) {
        c = parseInt(hex.substr(i*2,2), 16);
        c = Math.round(Math.min(Math.max(0, c + (c * lum)), 255)).toString(16);
        rgb += ("00"+c).substr(c.length);
    }

    return rgb;
};
