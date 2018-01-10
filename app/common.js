module.exports = {
  dateFormatter: date => {
    const options = { weekday: "long", month: "long", day: "numeric" };
    return new Date(date).toLocaleDateString("en-GB", options);
  },

  getCashText: cash => {
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
  }
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
