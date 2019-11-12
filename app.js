const http = require("http");
const fs = require("fs");
const WebSocket = require("ws");
const firmata = require("firmata");

const wss = new WebSocket.Server({ port: 8888 });

let board = new firmata.Board("/dev/ttyACM0", () => {
  //Potentiometer pins
  board.pinMode(0, board.MODES.ANALOG);
  board.pinMode(1, board.MODES.ANALOG);

  //DC motor pins
  board.pinMode(2, board.MODES.OUTPUT);
  board.pinMode(3, board.MODES.PWM);
});

fs.readFile("./index.html", (err, html) => {
  if (!err) {
    http
      .createServer((req, res) => {
        res.writeHeader(200, { "Content-Type": "text/html" });
        res.write(html);
        res.end();
      })
      .listen(8080, "192.168.1.223", () => {
        console.log("Server running ...");
      });
  }
});

let sendValue = function() {},
  values = { desiredValue: 0, actualValue: 0 },
  pwm = 0,
  error = 0,
  errorsSum = 0,
  dError = 0,
  lastError = 0;

const maxRightTurn = 875,
  maxLeftTrun = 135,
  kp = 1.2, // proportional factor of PID controller
  ki = 0.01, // integral factor of PID controller
  kd = 2.5; // differential factor of PID controller

board.on("ready", () => {
  board.analogRead(0, value => {
    error = values.desiredValue - values.actualValue;
    errorsSum += error;
    dError = error - lastError;
    pwm = kp * error + ki * errorsSum + kd * dError;
    lastError = error;

    //control DC motor direction .. HIGH for right .. LOW for left
    pwm > 0
      ? board.digitalWrite(2, board.HIGH)
      : board.digitalWrite(2, board.LOW);

    //control DC motor speed
    pwm = Math.abs(pwm);
    if (pwm > 255) pwm = 255;
    board.analogWrite(3, pwm);

    //set limits for maximum turns
    if (value > maxRightTurn) value = maxRightTurn;
    else if (value < maxLeftTrun) value = maxLeftTrun;

    values.desiredValue = value;
    sendValue(JSON.stringify(values));
  });

  board.analogRead(1, value => {
    values.actualValue = value;
    sendValue(JSON.stringify(values));
  });
}); //end of board.on(...)

wss.on("connection", ws => {
  sendValue = values => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(values);
      } catch (e) {
        console.log("Something went wrong ... " + e);
      }
    }
  };
});
