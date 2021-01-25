
let startTime;
let videoID;
let apiKey = process.env.apiKey;

var iso8601DurationRegex = /(-)?P(?:([.,\d]+)Y)?(?:([.,\d]+)M)?(?:([.,\d]+)W)?(?:([.,\d]+)D)?T(?:([.,\d]+)H)?(?:([.,\d]+)M)?(?:([.,\d]+)S)?/;

function formatViewCount(views) {
	if ( views.length < 4 ) {
		//up till 999
		return `${views} views`;
	} else if ( views.length < 7 ) {
		//up till 999,999
		return `${parseInt(parseInt(views)/1000)}K views`;
	} else if ( views.length < 10 ) {
		//up till 999,999,999
		return `${parseInt(parseInt(views)/1000000)}M views`;
	} else {
		//up till 999,999,999,999
		return `${parseInt(parseInt(views)/1000000000)}B views`;
	}
}

function minutes_between(date1, date2) {

    // The number of milliseconds in one day
    const ONE_MINUTE = 60000;

    // Calculate the difference in milliseconds
    const differenceMs = Math.abs(date1 - date2);

    // Convert back to days and return
    return Math.round(differenceMs / ONE_MINUTE);

}

function formatPublishDate(publishDate) {
	publishedAt = new Date(publishDate);
	today = new Date();
	const minutesSince = minutes_between(publishedAt,today)
	if ( minutesSince < 60 ) {
		// Up till 59 minutes
		return `${minutesSince} minute${(minutesSince>1) ? 's' : ''} ago`;
	} else if ( minutesSince < 1440 ) {
		// Up till 24 hours
		hoursSince = Math.floor(minutesSince/60);
		return `${hoursSince} hour${(hoursSince>1) ? 's' : ''} ago`;
	} else if ( minutesSince < 10080 ) {
		//Up till 7 days
		daysSince = Math.floor(minutesSince/1440);
		return `${daysSince} day${(daysSince>1) ? 's' : ''} ago`;
	} else if ( minutesSince < 40320 ) {
		//Up till 4 weeks
		weeksSince = Math.floor(minutesSince/10080);
		return `${weeksSince} week${(weeksSince>1) ? 's' : ''} ago`;
	} else if ( minutesSince < 525601 ) {
		//Up till 12 months
		monthsSince = Math.floor(minutesSince/40320);
		return `${monthsSince} month${(monthsSince>1) ? 's' : ''} ago`;
	} else {
		//Years
		yearsSince = Math.floor(minutesSince/525601);
		return `${yearsSince} year${(yearsSince>1) ? 's' : ''} ago`;
	}
}

function parseISO8601Duration (iso8601Duration) {
    var matches = iso8601Duration.match(iso8601DurationRegex);

    let result =  {
        sign: matches[1] === undefined ? '+' : '-',
        years: matches[2] === undefined ? 0 : matches[2],
        months: matches[3] === undefined ? 0 : matches[3],
        weeks: matches[4] === undefined ? 0 : matches[4],
        days: matches[5] === undefined ? 0 : matches[5],
        hours: matches[6] === undefined ? 0 : matches[6],
        minutes: matches[7] === undefined ? 0 : matches[7],
        seconds: matches[8] === undefined ? 0 : matches[8]
	};
	const totalSeconds = Number(result.hours*3600) + Number(result.minutes*60) + Number(result.seconds);
	return totalSeconds
};

function isWatched(duration,videoId) {
	//Make a call to youtube API and get duration of videoID
	//Duration is the duration watched
	//Compare duration to duration of video
	//If duration is shorter, add to unfinished videos

	//Only add videos which less than 75 percent have been watch, if someones watched 80 percent of it, don't add it
	console.log(`Watched video withID:${videoId} for ${duration} seconds`)
	let endpoint = `https://youtube.googleapis.com/youtube/v3/videos?part=contentDetails&part=snippet&part=statistics&id=${videoID}&key=${apiKey}`;

	var xhr = new XMLHttpRequest();
	xhr.open("GET", endpoint, true);
	xhr.onreadystatechange = function() {
		if (xhr.readyState == 4) {
		  var resp = JSON.parse(xhr.responseText);
		  const videoDetails = resp.items[0];
		  const videoDuration = parseISO8601Duration(videoDetails.contentDetails.duration);
		  const percentWatched = ((duration/videoDuration)*100).toFixed(2);
		  console.log(`Watched:${percentWatched}% of the video`);
		  if ( percentWatched < 75 ) {
			  console.log(`Didn't finish watching video with id:${videoId}`);
			  const videoObject = {
				  videoUrl: `https://youtube.com/watch?v=${videoId}`,
				  videoTitle: videoDetails.snippet.title,
				  videoThumbnail: videoDetails.snippet.thumbnails.medium.url,
				  videoViews: formatViewCount(videoDetails.statistics.viewCount),
				  publishedAt: formatPublishDate(videoDetails.snippet.publishedAt),
				  channelName: videoDetails.snippet.channelTitle,
				  channelId: videoDetails.snippet.channelId,
				  channelIcon: ''
			  }
			  console.log(videoObject);
			  chrome.storage.local.get({unfinishedVideos: []}, function (result) {
				// the input argument is ALWAYS an object containing the queried keys
				// so we select the key we need
				var unfinishedVideos = result.unfinishedVideos || [];
				unfinishedVideos.push(videoObject);
				// set the new array value to the same key
				chrome.storage.local.set({unfinishedVideos}, function () {
					// you can use strings instead of objects
					// if you don't  want to define default values
					chrome.storage.local.get('unfinishedVideos', function (result) {
						console.log(result.unfinishedVideos);
					});
				});
			});
		  } else {
			  console.log(`Finished watching video with id:${videoId}`);
		  }
		}
	}

	xhr.send();

}


chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
	//Cases
		//Youtube Homepage or non youtube url
		//Youtube Video
	let currVideoID;
	let isVid;
	if ( tab.url.includes('watch?v') ) {
		//Need to be more accurate here, might have extra stuff after ?v=
		currVideoID = tab.url.split('?v=')[1]
		isVid = true;
	}
	if (videoID && !(videoID == currVideoID)) {
		//Tab has changed while a current video was being tracked
		//Stop the timer, get the video duration, if the timer < duration, add to watched video
		//Reset time
		//If the tab is a new video, add new videoID
		let stopTime = new Date()
		let duration =  Math.abs(stopTime - startTime)/1000;

		isWatched(duration,videoID)
		//Reset time
		startTime = stopTime;
		if ( isVid ) {
			videoID = currVideoID;
		} else {
			videoID = ''
		}
	} else {
		//Tab has changed, while no video was being tracked
		//If this is a new video
			//Set start time to current time, add videoID
		//User has just arrived on youtube
		if ( isVid ) {
			videoID = currVideoID;
			startTime = new Date();
		}
	}
});
