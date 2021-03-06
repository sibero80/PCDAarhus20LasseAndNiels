
/*

SYNTH GESTURES
Stand up and let your hands play music!

What:
A simple synth sketch that maps hand (wrist) movement on the y axis to frequencies for each their oscillator.

Why not:
- If there's no sound coming through just hit space and see if its better.
- Perhaps you need to click or touch the canvas once or twice so the audio Context understands it   
  should get to work.

*/

let video;
let flippedVideo;
let poseNet;
let pose;
let skeleton;
let distance;
let remappedDist;

let wristL_x = 0;
let wristL_y = 0;
let wristR_x = 0;
let wristR_y = 0;
let eyelX = 0;
let eyelY = 0;

// Video width
let vWidth = 0; // or 640
let vHeight = 0; // or 480

// ml
// Classifier Variable
let classifier;
// Model URL
let imageModelURL = 'https://teachablemachine.withgoogle.com/models/gdHHJrrU/'
let label = ''
let confidenceThreshold = 0.80

// Oscillator
var oscillators = [
  { type: 'sine', playing: true, curPos: 0, curFreq: 0, mod: 0 },
  { type: 'sine', playing: true, curPos: 0, curFreq: 0, mod: 0 },
  // { type: 'sawtooth', playing: false, curPos: 0, curFreq: 0, mod: 0 }
]
var recentType = 'sine'
var button
var slider
// var playing = false;
// let curFreq = [];
let range = { min: 40, max: 400 }

// Load the model first
function preload () {
  classifier = ml5.imageClassifier(imageModelURL + 'model.json')
}

function setup () {
  // Stretch video
  // vWidth = windowWidth;
  // vHeight = windowHeight;
  // Respect aspect ratio
  vHeight = windowHeight;
  vWidth = vHeight * 1.333;
  createCanvas(vWidth, vHeight);
  video = createCapture(VIDEO);
  video.size(vWidth, vHeight);
  video.hide();

  // Flip video
  flippedVideo = ml5.flipImage(video)

  poseNet = ml5.poseNet(video, modelLoaded)
  // Flip image for PoseNet
  poseNet.flipHorizontal = true 
  poseNet.on('pose', gotPoses)

  // Synth
  oscillators.forEach(osc => {
    osc.wave = new p5.Oscillator()
    osc.wave.setType(osc.type)
    osc.wave.start()
    osc.wave.freq(440)
    osc.wave.amp(0.5); // Uncomment this when mod effect is not wanted
    // Modulate the carrier's amplitude with the modulator
    // Optionally, we can scale the signal.
    // osc.wave.amp(modulator.scale(-1, 1, 1, -1));
    // Modulator
    osc.mod = new p5.Oscillator('triangle')
    osc.mod.disconnect() // disconnect the modulator from master output
    osc.mod.freq(5)
    osc.mod.amp(1)
    osc.mod.start()
    // Hook osc up w/ its mod
    osc.wave.amp(0) // This lines enables the mod effect
    osc.wave.amp(osc.mod.scale(-1, 1, 1, -1)) // This lines enables the mod effect
  })

  // Modulate the carrier's amplitude with the modulator
  // Optionally, we can scale the signal.
  // oscillators[0].wave.amp(modulator.scale(-1, 1, 1, -1));

  // Create slider
  // slider = createSlider(100, 1200, 440)

  button = createButton('play/pause')
  button.mousePressed(toggle)

  // Start classifying
  classifyVideo()
}

function draw () {
  // Clear background
  background(0);
  // image(video, 0, 0, 640, 480);
  image(flippedVideo, 0, 0, vWidth, vHeight);

  // Draw the label
  fill(0, 255, 0)
  textSize(16)
  textAlign(CENTER)
  text(label, width / 2, height - 4)

  if (pose) {
    let eyeR = pose.rightEye
    let eyeL = pose.leftEye
    distance = dist(eyeR.x, eyeR.y, eyeL.x, eyeL.y)
    // Distance
    // print('distance: ' + distance);
    // Remap value
    remappedDist = map(distance, 0, 200, 20, 0)

    // let chosenLY = wristL_y // or pose.leftEar.y
    // let chosenRY = wristR_y// or pose.rightEar.y

    // Draw wrists
    fill(255, 0, 0);
    ellipse(wristL_x, wristL_y, distance);
    fill(0, 255, 0);
    ellipse(wristR_x, wristR_y, distance);

    // Draw ellipses for each point
    for (let i = 0; i < pose.keypoints.length; i++) {
      let x = pose.keypoints[i].position.x;
      let y = pose.keypoints[i].position.y;
      fill(0, 255, 0);
      ellipse(x, y, 16, 16);
    }

    // // Draw lines btw each connected point in skeleton
    for (let i = 0; i < skeleton.length; i++) {
      let a = skeleton[i][0];
      let b = skeleton[i][1];
      strokeWeight(2);
      stroke(255);
      line(a.position.x, a.position.y, b.position.x, b.position.y);
    }

    // This is where the frequency values are set for each oscillator
    // Set the different pos for each osc to be translated to a freq
    oscillators[0].curPos = wristL_y // or pose.leftEar.y
    oscillators[1].curPos = wristR_y// or pose.rightEar.y
  }

  // map mouseY to moodulator freq between 0 and 20hz
  // let modFreq = map(mouseY, 0, height, 20, 0);
  // modulator.freq(modFreq);

  // Synth
  // osc.freq(slider.value()); // The slider
  // Synth
  oscillators.forEach(osc => {
    // Update mods
    if (!osc.playing) {
      return
    }
    osc.mod.freq(remappedDist)
    let modAmp = map(mouseX, 0, width, 0, 1)
    osc.mod.amp(modAmp, 0.01) // fade time of 0.1 for smooth fading
    // Update oscillators
    // osc.curFreq = map(osc.curPos, 480, 0, range.min, range.max) org
    osc.curFreq = map(osc.curPos, vHeight, 0, range.min, range.max)
    osc.wave.freq(osc.curFreq)
  })
}

// Get a prediction for the current video frame
function classifyVideo () {
  flippedVideo = ml5.flipImage(video)
  classifier.classify(flippedVideo, gotResult)
}

function touchStarted() {
  getAudioContext().resume()
}

function gotPoses (poses) {
  //console.log(poses);
  if (poses.length > 0) {
    pose = poses[0].pose
    skeleton = poses[0].skeleton
  }
  // Ease pos values
  console.log(poses);
  if (poses.length > 0) {
    let wLX = poses[0].pose.keypoints[9].position.x;
    let wLY = poses[0].pose.keypoints[9].position.y;
    let wRX = poses[0].pose.keypoints[10].position.x;
    let wRY = poses[0].pose.keypoints[10].position.y;
    wristL_x = lerp(wristL_x, wLX, 0.5);
    wristL_y = lerp(wristL_y, wLY, 0.5);
    wristR_x = lerp(wristR_x, wRX, 0.5);
    wristR_y = lerp(wristR_y, wRY, 0.5);
    // eyelX = lerp(eyelX, eX, 0.5);
    // eyelY = lerp(eyelY, eY, 0.5);
  }
}

// When we get a result
function gotResult (error, results) {
  // If there is an error
  if (error) {
    console.error(error)
    return
  }
  // The results are in an array ordered by confidence.
  // console.log(results[0]);
  label = results[0].label
  
  // Classifiy again!
  classifyVideo()

  // Modify oscillator wave types if confidence is high enough
  // if (results[0].confidence < confidenceThreshold) {
  //   print('I do not believe it.')
  //   return
  // } else {
  //   print('Okay, I believe you.')
  // }
  // if (results[0].label == 'Class 1') { 
  //   oscillators[0].wave.setType('sine')
  //   oscillators[1].wave.setType('sine')
  //   recentType = 'sine'
  // } else if (results[0].label == 'Class 2') {
  //   oscillators[0].wave.setType('sawtooth')
  //   oscillators[1].wave.setType('sawtooth')
  //   recentType = 'sawtooth'
  // } else if (results[0].label == 'Class 3') {
  //   oscillators[0].wave.setType(recentType)
  //   oscillators[1].wave.setType(recentType)
  // }

  // log confidence
  // print('results: ' + JSON.stringify(results[0]))
}

// Toggle play and pause based on call from space bar
function toggle () {
  // Synth
  oscillators.forEach(osc => {
    if (!osc.playing) {
      print('should play')
      osc.wave.amp(0.5, 1)
      osc.mod.amp(1)
      osc.playing = true
    } else {
      print('should stop')
      osc.wave.amp(0, 1)
      osc.mod.amp(0)
      osc.playing = false
    }
  })
}

// Listen for key event on space bar
function keyPressed () {
  // print(keyCode)
  if (keyCode === 32) {
    toggle()
  }
  // if (value === 0) {
  //   value = 255;
  // } else {
  //   value = 0;
  // }
}

// Listen for resize
function windowResized() {
  vWidth = windowWidth;
  vHeight = windowHeight;
  resizeCanvas(vWidth, vHeight);
}

function modelLoaded () {
  console.log('poseNet ready')
}