"use strict";

let request = require("request");

const VERSION = "1.0";
const access_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjaSI6Im9hdXRoY2xpZW50XzAwMDA5NFB2SU5ER3pUM2s2dHo4anAiLCJleHAiOjE1MTQ1Nzk5MzQsImlhdCI6MTUxNDU1ODMzNCwianRpIjoidG9rXzAwMDA5UzNSNTFHWDdOSFF5RExFQ3YiLCJ1aSI6InVzZXJfMDAwMDk2RmFETEdNcmdjQjdtVFhJZiIsInYiOiIyIn0.7jMbPJzBTpPL5ht1jWtE_DVRtOpilbcJDr4p5KET7sw"
const BASE_URL = "https://api.monzo.com/";

module.exports = function(req, res) {
  if (req.body.request.type === "LaunchRequest") {
    res.json(
      buildResponse(
        { dateRequested: true },
        "<speak>Hello Jack, this is your monzo skill. Ask for your balance.</speak>",
        {},
        false
      )
    );
  } else if (req.body.request.type === "SessionEndedRequest") {
    if (req.body.request.reason === "ERROR") {
      console.error("Alexa ended the session due to an error");
    }
  } else if (
    req.body.request.type === "IntentRequest" &&
    req.body.request.intent.name === "Balance"
  ) {
    getBalance()
      .then(function(balance) {
        res.json(
          buildResponse(
            {},
            "<speak>" + balance.text + "</speak>",
            balance.card,
            true
          )
        );
      })
      .catch(function(err) {
        res.json(buildResponse({}, "<speak>" + err + "</speak>", {}, true));
      });
  } else {
    res
      .status(504)
      .json({
        message: "Sorry that Intent has not been added to our skill set"
      });
  }
};

function buildResponse(session, speech, card, end) {
  return {
    version: VERSION,
    sessionAttributes: session,
    response: {
      outputSpeech: {
        type: "SSML",
        ssml: speech
      },
      card: card,
      shouldEndSession: !!end
    }
  };
}

function getBalance() {
  return new Promise(function(resolve, reject) {
    request(
      {
        url: BASE_URL + "balance?account_id=acc_000097O438ahiqClRKOtU1",
        headers: {
          Authorization: `Bearer ${access_token}`
        },
        json: true
      },
      function(err, res, body) {
        let data, text, card;

        if (err || res.statusCode >= 400) {
          console.error(res.statusCode, err);
          return reject("Unable to get balance!");
        }

        if (!data) {
          return reject("Unable to get balance!");
        }

        text = getBalanceText(data);
        card = {
          type: "Standard",
          title: "Monzo card balance",
          text: text
        };

        resolve({ text, card });
      }
    );
  });
}

function getBalanceText(data) {
  let conditions;

  if (data.balance) {
    const amountParts = (amount / 100)
      .toFixed(2)
      .toString()
      .split(".");

    const majorUnits = +amountParts[0];
    const minorUnits = +amountParts[1];

    const responseParts = [];
    if (majorUnits !== 0 || minorUnits === 0)
      responseParts.push(
        `${majorUnits} ${currencyDefinition["GBP"].majorCurrencyUnit(
          majorUnits
        )}`
      );

    if (minorUnits !== 0 || majorUnits === 0)
      responseParts.push(
        `${minorUnits} ${currencyDefinition["GBP"].minorCurrencyUnit(
          minorUnits
        )}`
      );

    conditions = responseParts.join(" and ");
  }

  return conditions;
}

const currencyDefinition = {
  GBP: {
    majorCurrencyUnit(amount) {
      return amount === 1 ? "pound" : "pounds";
    },
    minorCurrencyUnit(amount) {
      return "pence";
    }
  }
};
