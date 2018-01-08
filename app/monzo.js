"use strict";

const request = require("request");
const AmazonDateParser = require("amazon-date-parser");

const VERSION = "1.0";
const access_token =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjaSI6Im9hdXRoY2xpZW50XzAwMDA5NFB2SU5ER3pUM2s2dHo4anAiLCJleHAiOjE1MTU0Mjg3MzcsImlhdCI6MTUxNTQwNzEzNywianRpIjoidG9rXzAwMDA5U05uYzVBdmdlaDk5dVVqWFYiLCJ1aSI6InVzZXJfMDAwMDk2RmFETEdNcmdjQjdtVFhJZiIsInYiOiIyIn0.Gz7pCnG6qO5C4P17Ihq1hbAMh62w2P9QoAyb1I1fB94";
const BASE_URL = "https://api.monzo.com/";

module.exports = function(req, res) {
  if (req.body.request.type === "LaunchRequest") {
    res.json(
      buildResponse(
        { dateRequested: true },
        "<speak>Hello, this is your Monzo skill. Ask for your balance.</speak>",
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
  } else if (
    req.body.request.type === "IntentRequest" &&
    req.body.request.intent.name === "Transactions"
  ) {
    getTransactions(req.body.request.intent.slots.amount.value)
      .then(function(transactions) {
        res.json(
          buildResponse(
            {},
            "<speak>" + transactions.text + "</speak>",
            transactions.card,
            true
          )
        );
      })
      .catch(function(err) {
        res.json(buildResponse({}, "<speak>" + err + "</speak>", {}, true));
      });
  } else if (
    req.body.request.type === "IntentRequest" &&
    req.body.request.intent.name === "LastTopUp"
  ) {
    getLastTopUp()
      .then(function(lastTopUp) {
        res.json(
          buildResponse(
            {},
            "<speak>" + lastTopUp.text + "</speak>",
            lastTopUp.card,
            true
          )
        );
      })
      .catch(function(err) {
        res.json(buildResponse({}, "<speak>" + err + "</speak>", {}, true));
      });
  } else if (
    req.body.request.type === "IntentRequest" &&
    req.body.request.intent.name === "LastSpend"
  ) {
    const amazonDate = new AmazonDateParser(
      req.body.request.intent.slots.duration.value
    );
    getLastTimePeriodSpend(amazonDate)
      .then(function(lastSpend) {
        res.json(
          buildResponse(
            {},
            "<speak>" + lastSpend.text + "</speak>",
            lastSpend.card,
            true
          )
        );
      })
      .catch(function(err) {
        res.json(buildResponse({}, "<speak>" + err + "</speak>", {}, true));
      });
  } else if (
    req.body.request.type === "IntentRequest" &&
    req.body.request.intent.name === "SpendByVendor"
  ) {
    const vendor = req.body.request.intent.slots.vendor.value;
    getTotalVendorSpend(vendor.toLowerCase())
      .then(function(vendorSpend) {
        res.json(
          buildResponse(
            {},
            "<speak>" + vendorSpend.text + "</speak>",
            vendorSpend.card,
            true
          )
        );
      })
      .catch(function(err) {
        res.json(buildResponse({}, "<speak>" + err + "</speak>", {}, true));
      });
  } else if (
    req.body.request.type === "IntentRequest" &&
    req.body.request.intent.name === "ListVendors"
  ) {
    getVendors()
    .then(function(vendors) {
      res.json(
        buildResponse(
          {},
          "<speak>" + vendors.text + "</speak>",
          vendors.card,
          true
        )
      );
    })
    .catch(function(err) {
      res.json(buildResponse({}, "<speak>" + err + "</speak>", {}, true));
    });
  } else {
    res.status(504).json({
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

function getVendors() {
  return new Promise((resolve, reject) => {
    request(
      {
        url: BASE_URL + "transactions?expand[]=merchant&account_id=acc_00009RwlYFxmBrRmHYTLKz",
        headers: {
          Authorization: `Bearer ${access_token}`
        },
        json: true
      },
      function(err, res, body) {
        let text, card;
        if (err || res.statusCode >= 400) {
          console.error(res.statusCode, err);
          return reject("Unable to get vendors!");
        }

        if (!body) {
          return reject("Unable to get vendors!");
        }

        const vendorList = getListOfVendors(body);

        if (vendorList != '') {
          text = vendorList;
        } else {
          text =
            "Sorry, Couldn't get the list of vendors.";
        }

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

function getBalance() {
  return new Promise((resolve, reject) => {
    request(
      {
        url: BASE_URL + "balance?account_id=acc_00009RwlYFxmBrRmHYTLKz",
        headers: {
          Authorization: `Bearer ${access_token}`
        },
        json: true
      },
      function(err, res, body) {
        let text, card;
        if (err || res.statusCode >= 400) {
          console.error(res.statusCode, err);
          return reject("Unable to get balance!");
        }

        if (!body) {
          return reject("Unable to get balance!");
        }

        text = `Your balance is: ${getBalanceText(body)}`;
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

function getTransactions(numberOfTransactions) {
  return new Promise((resolve, reject) => {
    request(
      {
        url:
          BASE_URL +
          "transactions?expand[]=merchant&account_id=acc_00009RwlYFxmBrRmHYTLKz",
        headers: {
          Authorization: `Bearer ${access_token}`
        },
        json: true
      },
      function(err, res, body) {
        let text, card;
        if (err || res.statusCode >= 400) {
          console.error(res.statusCode, err);
          return reject("Unable to get transactions!");
        }

        if (!body) {
          return reject("Unable to get transactions!");
        }

        const transactionsText = getTransactionsText(
          body,
          numberOfTransactions
        );

        if (transactionsText.length > 0) {
          text = `Your last ${numberOfTransactions} transactions are: ${transactionsText}`;
        } else {
          text = "Sorry, no transactions available";
        }

        card = {
          type: "Standard",
          title: "Monzo card transactions",
          text: text
        };

        resolve({ text, card });
      }
    );
  });
}

function getLastTopUp() {
  return new Promise((resolve, reject) => {
    request(
      {
        url:
          BASE_URL +
          "transactions?expand[]=merchant&account_id=acc_00009RwlYFxmBrRmHYTLKz",
        headers: {
          Authorization: `Bearer ${access_token}`
        },
        json: true
      },
      function(err, res, body) {
        let text, card;
        if (err || res.statusCode >= 400) {
          console.error(res.statusCode, err);
          return reject("Unable to get last top up!");
        }

        if (!body) {
          return reject("Unable to get last top up!");
        }

        const topUpText = getLastTopUpText(body);

        if (topUpText != null) {
          text = topUpText;
        } else {
          text = "Couldn't get your last top up.";
        }

        card = {
          type: "Standard",
          title: "Monzo card transactions",
          text: text
        };

        resolve({ text, card });
      }
    );
  });
}

function getLastTimePeriodSpend(amazonDate) {
  const start = new Date(amazonDate.startDate);
  const end = new Date(amazonDate.endDate);
  return new Promise((resolve, reject) => {
    request(
      {
        url:
          BASE_URL +
          "transactions?expand[]=merchant&account_id=acc_00009RwlYFxmBrRmHYTLKz&since=" +
          start.toISOString() +
          "&before=" +
          end.toISOString(),
        headers: {
          Authorization: `Bearer ${access_token}`
        },
        json: true
      },
      function(err, res, body) {
        let text, card;
        if (err || res.statusCode >= 400) {
          console.error(res.statusCode, err, res);
          return reject("Unable to get last spend!");
        }

        if (!body) {
          return reject("Unable to get last spend!");
        }

        const lastSpendText = getLastTimePeriodSpendText(body);

        if (lastSpendText != null) {
          text = lastSpendText;
        } else {
          text =
            "Couldn't get your last spend for the time period you provided.";
        }

        card = {
          type: "Standard",
          title: "Monzo card transactions",
          text: text
        };

        resolve({ text, card });
      }
    );
  });
}

function getTotalVendorSpend(vendor) {
  console.log(vendor);
  return new Promise((resolve, reject) => {
    request(
      {
        url:
          BASE_URL +
          "transactions?expand[]=merchant&account_id=acc_00009RwlYFxmBrRmHYTLKz",
        headers: {
          Authorization: `Bearer ${access_token}`
        },
        json: true
      },
      function(err, res, body) {
        let text, card;
        if (err || res.statusCode >= 400) {
          console.error(res.statusCode, err, res);
          return reject("Unable to get the total spend for that vendor!");
        }

        if (!body) {
          return reject("Unable to get the total spend for that vendor!");
        }

        const vendorSpendText = getTotalVendorSpendText(body, vendor);

        if (vendorSpendText != null) {
          text = vendorSpendText;
        } else {
          text =
            `Couldn't get the total spend for ${vendor}.`;
        }

        card = {
          type: "Standard",
          title: "Monzo card transactions",
          text: text
        };

        resolve({ text, card });
      }
    );
  });
}

function getListOfVendors(data) {
  let vendorSpendText = '';

  if (data.transactions) {
    for (let transaction of data.transactions) {
      if (transaction.merchant != null) {
        const merchantName = transaction.merchant.name.toLowerCase();
        vendorSpendText += `${merchantName}, `;
      }
    }
  }

  return vendorSpendText;
}

function getTotalVendorSpendText(data, vendor) {
  let totalSpend = 0;
  let vendorSpendText;

  if (data.transactions) {
    for (let transaction of data.transactions) {
      if (transaction.merchant != null) {
        const merchantName = transaction.merchant.name.toLowerCase();
        if (merchantName.includes(vendor) || vendor.includes(merchantName)) {
            const amount = parseInt(transaction.amount);
            if (!isNaN(amount)) {
              totalSpend += Math.abs(amount);
            }
        }
      }
    }
    if (totalSpend === 0) {
      vendorSpendText = `Sorry couldn't find any transactions for ${vendor}.`
    } else {
      vendorSpendText = `At ${vendor} you spent ${getCashText(totalSpend)}`;
    }
  }

  return vendorSpendText;
}

function getLastTimePeriodSpendText(data) {
  let spendText;
  let totalSpend = 0;

  if (data.transactions) {
    for (let transaction of data.transactions) {
      if (transaction.amount < 0) {
        const amount = parseInt(transaction.amount);
        if (!isNaN(amount)) {
          totalSpend += Math.abs(amount);
        }
      }
    }

    spendText = `You spent ${getCashText(totalSpend)}`;
  }

  return spendText;
}

function getLastTopUpText(data) {
  let topUpText;

  if (data.transactions) {
    const reversedTransactions = data.transactions.reverse();
    for (let transaction of reversedTransactions) {
      if (transaction.description === "Top up") {
        topUpText = `You topped up ${getCashText(
          transaction.amount
        )} on ${dateFormatter(transaction.created)}. `;
        break;
      }
    }
  }
  return topUpText;
}

function getTransactionsText(data, transactionAmount) {
  let transactionsText = "";

  if (data.transactions) {
    const lastSetOfTransactions = data.transactions
      .slice(
        data.transactions.length - transactionAmount,
        data.transactions.length
      )
      .reverse();

    lastSetOfTransactions.forEach(transaction => {
      const amountSpend = transaction.amount;
      let transactionText = "";
      console.log(transaction);
      if (transaction.description === "Top up") {
        transactionText = `Top Up of ${getCashText(
          amountSpend
        )} on ${dateFormatter(transaction.created)}. `;
      } else if (Object.keys(transaction.counterparty).length > 0) {
        if (transaction.amount > 0) {
          transactionText = `Got Paid ${getCashText(amountSpend)} from ${
            transaction.counterparty.prefered_name
          } on ${dateFormatter(transaction.created)}. `;
        } else {
          transactionText = `You paid ${
            transaction.counterparty.prefered_name
          }, ${getCashText(Math.abs(amountSpend))} on ${dateFormatter(
            transaction.created
          )}. `;
        }
      } else if (
        transaction.merchant != null &&
        Object.keys(transaction.merchant).length > 0
      ) {
        transactionText = `Spent ${getCashText(Math.abs(amountSpend))} at ${
          transaction.merchant.name
        } on ${dateFormatter(transaction.created)}. `;
      }
      console.log(transactionText);
      transactionsText += transactionText;
    });
  }

  return transactionsText;
}

function getBalanceText(data) {
  let conditions;
  if (data.balance) {
    conditions = getCashText(data.balance);
  }

  return conditions;
}

const getCashText = cash => {
  const poundsAndPence = (cash / 100)
    .toFixed(2)
    .toString()
    .split(".");

  const pounds = +poundsAndPence[0];
  const pence = +poundsAndPence[1];

  const responseParts = [];
  if (pounds !== 0 || pence === 0)
    responseParts.push(`${pounds} ${currencyParser["GBP"].pounds(pounds)}`);

  if (pence !== 0 || pounds === 0)
    responseParts.push(`${pence} ${currencyParser["GBP"].pence(pence)}`);

  return responseParts.join(" and ");
};

const currencyParser = {
  GBP: {
    pounds(amount) {
      return amount === 1 ? "pound" : "pounds";
    },
    pence(amount) {
      return "pence";
    }
  }
};

const dateFormatter = date => {
  const options = { weekday: "long", month: "long", day: "numeric" };
  return new Date(date).toLocaleDateString("en-GB", options);
};
