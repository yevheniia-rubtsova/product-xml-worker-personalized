import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";

const inputPath = path.resolve(
  "src/data/merchant_categories.xml"
);

const outputPath = path.resolve(
  "src/data/generated-categories.json"
);

const xml = fs.readFileSync(
  inputPath,
  "utf8"
);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

const parsed = parser.parse(xml);

const sourceCategories = Array.isArray(
  parsed.categories.category
)
  ? parsed.categories.category
  : [parsed.categories.category];

function toArray(value) {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value)
    ? value
    : [value];
}

const categories = sourceCategories.map(
  (category) => {
    const groupedAttributes = new Map();

    for (const attribute of toArray(category.attribute)) {
      if (attribute.type === "unknown") {
        continue;
      }

      const existing =
        groupedAttributes.get(attribute.nameUK) ?? {
          nameUK: attribute.nameUK,
          type: attribute.type,
          values: new Set(),
        };

      for (const value of toArray(
        attribute.attribute_value
      )) {
        if (value?.nameUK) {
          existing.values.add(value.nameUK);
        }
      }

      groupedAttributes.set(
        attribute.nameUK,
        existing
      );
    }

    return {
      portal_id: String(category.portal_id),
      nameUK: category.nameUK,
      attributes: Array.from(
        groupedAttributes.values()
      ).map((attribute) => ({
        nameUK: attribute.nameUK,
        type: attribute.type,
        values: Array.from(attribute.values),
      })),
    };
  }
);

fs.writeFileSync(
  outputPath,
  JSON.stringify(categories)
);

console.log(
  `Generated ${categories.length} categories`
);

console.log(
  `Saved to ${outputPath}`
);