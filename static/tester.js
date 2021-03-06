/* Tester.js - Contains functions for running automatic tests of maps */

var minLat, minLon, maxLat, maxLon; //Coordinate area to move around in
var minZoom, maxZoom; //Zoom levels to move between
var testMap; //The map controller we zoom around with
var totalIterations;
var iterationsRemaining; //The number of iterations we have left of the test round.
var times;
var testName;

var startTime;

var currentTimeOutID;

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
	
	startTime = (new Date()).getTime();
	
	// We add an ekstra iteration because the first one is not reliable due to setup costs
	iterationsRemaining = iterations +1;
	totalIterations = iterations +1;
	times = new Array (iterations +1);
	times[0] = [0, 0, 0]; //This one gets chopped off at the end bc/ setup gives unreliable timing results
	currentTimeOutID = window.setTimeout(moveRandomly, 45000); //In case the movement hangs for unknown reasons, we will restart it.
}

//Equivalent to tileLoadingCompleted
function tileConcatStarted () {
	times[totalIterations - iterationsRemaining][1] = (new Date()).getTime();
}

function tileConcatCompleted () {
	//Add the timing data
	times[totalIterations - iterationsRemaining][2] = (new Date()).getTime();
	
	window.clearTimeout (currentTimeOutID); //Concat achieved, clear the timeout timer
	
	//Check if we continue
	if (iterationsRemaining == 0) {
		generateFinalReport ();
	} else {
		iterationsRemaining -= 1;
		//moveRandomly ();
		window.setTimeout(moveRandomly, 1000);
		currentTimeOutID = window.setTimeout(moveRandomly, 45000); //In case the movement hangs for unknown reasons, we will restart it.

	}
}

function moveRandomly () {
	var targetLat = Math.random() * (maxLat - minLat) + minLat;
	var targetLon = Math.random() * (maxLon - minLon) + minLon;
	var targetZoom = Math.floor(Math.random() * (maxZoom - minZoom + 1)) + minZoom;
	
	testMap.center({lat: targetLat, lon: targetLon});
	testMap.zoom(targetZoom);
	
	times[totalIterations - iterationsRemaining] = [(new Date()).getTime(), 0, 0]; //Start registering time for the movement
}

function generateFinalReport () {
	console.log ("Generating report");
	
	var totalTime = (new Date()).getTime() - startTime;
	
	//Correcting for the first timing not being reliable
	totalIterations -= 1;
	times.shift ();
	
	//Create report text
	var n = "%0A"; //newline
	var output = "Report for " + testName + ", " + totalIterations + " iterations." + n;
	output += "Total time used testing is: " + totalTime + " ms = " + (totalTime/1000) + " s" + n;
	output += "Format is Iteration No. - Tile Load Time - Tile Concat Time, in milliseconds " + n;
	
	for (var i = 0; i< totalIterations; i++) {
		output += (i+1) + " " + ( times[i][1] - times[i][0]) + " " + (times[i][2] - times[i][1]) + n;
	}
	
	//Send report text to user
	var dataUri = "data:," + output
	
	window.location.href = dataUri;
}
