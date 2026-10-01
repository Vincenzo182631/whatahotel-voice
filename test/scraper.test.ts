import { describe, expect, it } from "vitest";
import { parseWhataHotelPage } from "../src/sources/whatahotel.js";

const html = `<html><head>
<script type="application/ld+json">{"@graph":[{"@type":"Hotel","name":"Il San Pietro di Positano ",
"address":{"streetAddress":"Via Laurito 2","addressLocality":"Positano","postalCode":"84017","addressCountry":"IT"},
"starRating":{"ratingValue":"5"}}]}</script></head><body>
<h3>An Insider's Take</h3><p>'Perched on the cliff.'</p>
<h3>What&#39;s Special?</h3><p>Rooms built into the cliff.</p>
<h4>WhatAHotel! Pro-Tip:</h4><p>Book a lower level.</p>
<h4>Don't Miss</h4><p>Sunset cocktails.</p>
<div>Insights, Pros &amp; Cons, and Ratings for enhanced comparisons.</div><b>4.8</b><span>Average Rating</span>
<div>Pros:</div><li>Views</li><li>Private beach</li>
<div>Cons:</div><li>Premium pricing</li>
<div>Special Offer</div><li>Third night free</li>
<div>Perks Comparison</div></body></html>`;

describe("parseWhataHotelPage", () => {
  it("extracts editorial fields and stops cons at the offer block", () => {
    const page = parseWhataHotelPage(html, "https://www.whatahotel.com/hotels/1720/x.html", new Date(0));
    expect(page).toMatchObject({
      whatahotel_id: 1720,
      name: "Il San Pietro di Positano",
      address: { city: "Positano", country: "IT" },
      star_rating: 5,
      average_rating: 4.8,
      insider_take: "Perched on the cliff.",
      whats_special: "Rooms built into the cliff.",
      pro_tip: "Book a lower level.",
      dont_miss: "Sunset cocktails.",
      pros: ["Views", "Private beach"],
      cons: ["Premium pricing"],
    });
  });
});
