export async function handler(event) {
  try {
    const text = event.queryStringParameters?.text;

    if (!text || text.length < 5) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Adresse manquante" })
      };
    }

    const url =
      "https://api.openrouteservice.org/geocode/search?" +
      new URLSearchParams({
        api_key: process.env.ORS_API_KEY,
        text,
        size: 1,
        "boundary.country": "BE"
      });

    const res = await fetch(url);

    if (!res.ok) {
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: "Erreur OpenRouteService" })
      };
    }

    const data = await res.json();

    if (!data.features || !data.features.length) {
      return {
        statusCode: 200,
        body: JSON.stringify({})
      };
    }

    const f = data.features[0];
    const [lng, lat] = f.geometry.coordinates;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        lat,
        lng,
        label: f.properties?.label || text
      })
    };

  } catch (e) {
    console.error("GEOCODE ERROR", e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erreur serveur" })
    };
  }
}
