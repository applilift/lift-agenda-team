// netlify/functions/create-checkout-session.js
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const data = JSON.parse(event.body || "{}");
    const { type, total } = data;

    if (!type) {
      return { statusCode: 400, body: "Missing type" };
    }

    let amountInCents;
    let description;

    if (type === "forfait") {
      amountInCents = 6000; // 60 €
      description = "Forfait Lift";
    } else if (type === "total") {
      if (!total) {
        return { statusCode: 400, body: "Missing total" };
      }

      const parsed = parseFloat(String(total).replace(",", "."));
      if (!(parsed > 0)) {
        return { statusCode: 400, body: "Invalid total" };
      }

      amountInCents = Math.round(parsed * 100);
      description = "Paiement total Lift";
    } else {
      return { statusCode: 400, body: "Invalid type" };
    }

    const baseUrl = process.env.BASE_URL || "https://lift-agenda-team.netlify.app/client";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: description },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/retour_stripe.html?status=success&type=${type}&amount=${amountInCents / 100}`,
      cancel_url: `${baseUrl}/retour_stripe.html?status=cancel&type=${type}`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: "Erreur création session Stripe",
    };
  }
};
