/* Tester.js - Contains functions for running automatic tests of maps */

var minLat, minLon, maxLat, maxLon; //Coordinate area to move around in
var minZoom, maxZoom; //Zoom levels to move between
var testMap; //The map controller we zoom around with
var totalIterations;
var iterationsRemaining; //The number of iterations we have left of the test round.
var times;
var testName;

function setUpTester(coordBoundary, zoomBoundary, map, test_name) {
	minLat = coordBoundary[0];
	minLon = coordBoundary[1];
	maxLat = coordBoundary[2];
	maxLon = coordBoundary[3];
	minZoom = zoomBoundary[0];
	maxZoom = zoomBoundary[1];
	testMap = map;
	testName = test_name;
	
	var iterations = new Number (prompt ("Please enter the number of test iterations","3"));
	
	if (iterations == "NaN") {
		alert ("The entered value was not a number, aborting test runs!");
		return;
	}
	
	
	iterationsRemaining = iterations;
	totalIterations = iterations;
	times = new Array (iterations);
	times[0] = [0, 0, 0]; //This one gets overwritten by the first concatcompleted
}

//Equivalent to tileLoadingCompleted
function tileConcatStarted () {
	times[totalIterations - iterationsRemaining][1] = (new Date()).getTime();
}

function tileConcatCompleted () {
	//Add the timing data
	times[totalIterations - iterationsRemaining][2] = (new Date()).getTime();
	
	//Check if we continue
	if (iterationsRemaining == 0) {
		generateFinalReport ();
	} else {
		iterationsRemaining -= 1;
		moveRandomly ();
		times[totalIterations - iterationsRemaining] = [(new Date()).getTime(), 0, 0];
	}
}

function moveRandomly () {
	var targetLat = Math.random() * (maxLat - minLat) + minLat;
	var targetLon = Math.random() * (maxLon - minLon) + minLon;
	var targetZoom = Math.floor(Math.random() * (maxZoom - minZoom + 1)) + minZoom;
	
	testMap.center({lat: targetLat, lon: targetLon});
	testMap.zoom(targetZoom);
}

function generateFinalReport () {
	console.log ("Generating report");
	
	//Create report text
	var n = "%0A"; //newline
	var output = "Report for " + testName + ", " + totalIterations + " iterations." + n;
	
	for (var i = 0; i< 10000; i++) {
	
		output = output + i + " " + i + " " + i + " " + i +n
	}
	
	//Send report text to user
	var dataUri = "data:," + output
	
	window.location.href = dataUri;
}
