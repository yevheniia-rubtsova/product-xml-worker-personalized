import generatedCategories from "./data/generated-categories.json";
import brandsCsv from "./data/brands.csv";
import countriesCsv from "./data/countries.csv";

const MAIN_IMAGE_URL =
  "https://raw.githubusercontent.com/yevheniia-rubtsova/product-xml-worker/refs/heads/main/test-assets/main-test-image.jpg";

const OVERSIZED_IMAGE_URL =
  "https://raw.githubusercontent.com/yevheniia-rubtsova/product-xml-worker/refs/heads/main/test-assets/oversized-test-image.jpg";

type Attribute = {
  nameUK: string;
  type: "multiselect" | "singleselect";
  values: string[];
};

type Category = {
  portal_id: string;
  nameUK: string;
  attributes: Attribute[];
};

const categories: Category[] =
  generatedCategories as Category[];

const brands = brandsCsv
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .slice(1);

const countries = countriesCsv
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .slice(1);

function getCategoryAttributes(category: Category): Attribute[] {
  return category.attributes;
}

function getAttributeValues(attribute: Attribute): string[] {
  return attribute.values;
}

function characteristicExists(name: string): boolean {
  return categories.some((category) =>
    getCategoryAttributes(category).some(
      (attribute) =>
        attribute.nameUK === name
    )
  );
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed: string): () => number {
  let state = hashString(seed);

  return () => {
    state += 0x6d2b79f5;

    let t = state;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(
  random: () => number,
  min: number,
  max: number
): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function pickOne<T>(
  random: () => number,
  items: T[]
): T {
  return items[randomInt(random, 0, items.length - 1)];
}

function pickMany<T>(
  random: () => number,
  items: T[],
  min: number,
  max: number
): T[] {
  if (items.length === 0) {
    return [];
  }

  const limit = Math.min(max, items.length);
  const count = randomInt(random, Math.min(min, limit), limit);

  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(random, 0, i);

    [shuffled[i], shuffled[j]] = [
      shuffled[j],
      shuffled[i],
    ];
  }

  return shuffled.slice(0, count);
}

function pickDifferentOne<T>(
  random: () => number,
  items: T[],
  current: T
): T {
  const alternatives = items.filter(
    (item) => item !== current
  );

  if (alternatives.length === 0) {
    return current;
  }

  return pickOne(random, alternatives);
}

function arraysEqual<T>(
  first: T[],
  second: T[]
): boolean {
  if (first.length !== second.length) {
    return false;
  }

  return first.every(
    (value, index) =>
      value === second[index]
  );
}

type GeneratedParam = {
  name: string;
  values: string[];
};

type GeneratedProduct = {
  id: number;
  available: boolean;

  nameUa: string;
  nameRu: string;

  descriptionUa: string;
  descriptionRu: string;

  price: number;
  oldPrice: number;

  categoryId: number;
  categoryName: string;
  portalId: string;

  vendor: string;
  country: string;

  temperatureMode: string;

  pictures: string[];

  params: GeneratedParam[];
};

function generateParamsForCategory(
  seed: string,
  index: number,
  category: Category
): GeneratedParam[] {
  const random = createSeededRandom(
    `${seed}:params:${index}:${category.portal_id}`
  );

  const params: GeneratedParam[] = [];

  for (const attribute of getCategoryAttributes(category)) {
    const values = getAttributeValues(attribute);

    if (values.length === 0) {
      continue;
    }

    if (attribute.type === "singleselect") {
      const selected = pickOne(
        random,
        values
      );

      params.push({
        name: attribute.nameUK,
        values: [selected],
      });

      continue;
    }

    if (attribute.type === "multiselect") {
      const selected = pickMany(
        random,
        values,
        1,
        5
      );

      params.push({
        name: attribute.nameUK,
        values: selected,
      });
    }
  }

  return params;
}

function generateChangedParam(
  seed: string,
  index: number,
  category: Category,
  currentParam: GeneratedParam
): GeneratedParam {
  const attribute = getCategoryAttributes(category).find(
    (item) =>
      item.nameUK === currentParam.name
  );

  if (!attribute) {
    return currentParam;
  }

  const values = getAttributeValues(attribute);

  if (values.length === 0) {
    return currentParam;
  }

  const random = createSeededRandom(
    `${seed}:changed-param:${index}:${category.portal_id}:${currentParam.name}`
  );

  if (attribute.type === "singleselect") {
    const currentValue = currentParam.values[0];

    const alternatives = values.filter(
      (value) => value !== currentValue
    );

    if (alternatives.length === 0) {
      return currentParam;
    }

    const selected = pickOne(
      random,
      alternatives
    );

    return {
      name: currentParam.name,
      values: [selected],
    };
  }

  const maxValues = Math.min(
    5,
    values.length
  );

  const currentSorted =
    [...currentParam.values].sort();

  for (let attempt = 0; attempt < 10; attempt++) {
    const selected = pickMany(
      random,
      values,
      1,
      maxValues
    );

    const selectedSorted =
      [...selected].sort();

    if (!arraysEqual(currentSorted, selectedSorted)) {
      return {
        name: currentParam.name,
        values: selected,
      };
    }
  }

  const alternativeValue =
    values.find(
      (value) =>
        !currentParam.values.includes(value)
    );

  if (alternativeValue) {
    return {
      name: currentParam.name,
      values: [alternativeValue],
    };
  }

  if (currentParam.values.length > 1) {
    return {
      name: currentParam.name,
      values: currentParam.values.slice(0, -1),
    };
  }

  return currentParam;
}

function selectCategories(
  random: () => number,
  requestedPortalIds: string[],
  count: number
): Category[] {
  const availableCategories =
    requestedPortalIds.length > 0
      ? categories.filter((category) =>
          requestedPortalIds.includes(category.portal_id)
        )
      : categories;

  if (availableCategories.length === 0) {
    return [];
  }

  if (requestedPortalIds.length === 0) {
    return Array.from({ length: count }, () =>
      pickOne(random, availableCategories)
    );
  }

  const selected: Category[] = [];

  const shuffledCategories = [...availableCategories];

  for (let i = shuffledCategories.length - 1; i > 0; i--) {
    const j = randomInt(random, 0, i);

    [shuffledCategories[i], shuffledCategories[j]] = [
      shuffledCategories[j],
      shuffledCategories[i],
    ];
  }

  for (let index = 0; index < count; index++) {
    selected.push(
      shuffledCategories[index % shuffledCategories.length]
    );
  }

  return selected;
}

function generateCategoryId(
  seed: string,
  portalId: string
): number {
  return (
    100_000 +
    (hashString(`${seed}:category:${portalId}`) % 900_000)
  );
}

function generateProductId(
  seed: string,
  index: number
): number {
  return (
    1_000_000_000 +
    (hashString(`${seed}:product:${index}`) % 900_000_000)
  );
}

function generatePrice(
  seed: string,
  index: number
): number {
  const random = createSeededRandom(
    `${seed}:price:${index}`
  );

  return randomInt(random, 50, 5000);
}

function generateOldPrice(
  seed: string,
  index: number,
  price: number
): number {
  const random = createSeededRandom(
    `${seed}:old-price:${index}`
  );

  return price + randomInt(random, 10, 1000);
}

function generateChangedPrice(
  seed: string,
  index: number,
  currentPrice: number
): number {
  const random = createSeededRandom(
    `${seed}:changed-price:${index}`
  );

  let newPrice = randomInt(random, 50, 5000);

  if (newPrice === currentPrice) {
    newPrice =
      currentPrice < 5000
        ? currentPrice + 1
        : currentPrice - 1;
  }

  return newPrice;
}

function generateChangedOldPrice(
  seed: string,
  index: number,
  newPrice: number,
  currentOldPrice: number
): number {
  const random = createSeededRandom(
    `${seed}:changed-old-price:${index}`
  );

  let newOldPrice =
    newPrice + randomInt(random, 10, 1000);

  if (newOldPrice === currentOldPrice) {
    newOldPrice += 1;
  }

  return newOldPrice;
}

function generateBrand(
  seed: string,
  index: number
): string {
  const random = createSeededRandom(
    `${seed}:brand:${index}`
  );

  return pickOne(random, brands);
}

function generateCountry(
  seed: string,
  index: number
): string {
  const random = createSeededRandom(
    `${seed}:country:${index}`
  );

  return pickOne(random, countries);
}

function generateChangedBrand(
  seed: string,
  index: number,
  currentBrand: string
): string {
  const random = createSeededRandom(
    `${seed}:changed-brand:${index}`
  );

  return pickDifferentOne(
    random,
    brands,
    currentBrand
  );
}

function generateChangedCountry(
  seed: string,
  index: number,
  currentCountry: string
): string {
  const random = createSeededRandom(
    `${seed}:changed-country:${index}`
  );

  return pickDifferentOne(
    random,
    countries,
    currentCountry
  );
}

function generatePictures(
  seed: string,
  index: number
): string[] {
  const random = createSeededRandom(
    `${seed}:pictures:${index}`
  );

  const imageCount = randomInt(random, 1, 12);

  const pictures = [MAIN_IMAGE_URL];

  for (let pictureIndex = 1; pictureIndex < imageCount; pictureIndex++) {
    pictures.push(
      `https://placehold.co/600x600.jpg?text=product-${index + 1}-${pictureIndex + 1}`
    );
  }

  return pictures;
}

function generateChangedPictures(
  seed: string,
  index: number,
  currentPictures: string[]
): string[] {
  const random = createSeededRandom(
    `${seed}:changed-pictures:${index}`
  );

  let imageCount = randomInt(random, 1, 12);

  if (imageCount === currentPictures.length) {
    imageCount =
      imageCount < 12
        ? imageCount + 1
        : imageCount - 1;
  }

  const pictures = [MAIN_IMAGE_URL];

  for (let pictureIndex = 1; pictureIndex < imageCount; pictureIndex++) {
    pictures.push(
      `https://placehold.co/600x600.jpg?text=changed-${index + 1}-${pictureIndex + 1}`
    );
  }

  return pictures;
}

const PRODUCT_NAME_PARAM_PRIORITY = [
  "Тип",
  "Вид",
  "Смак",
  "Аромат",
  "Колір",
  "Розмір",
  "Об'єм",
  "Вага",
  "Кількість",
  "Кількість в упаковці",
  "Призначення",
  "Матеріал",
  "Форма",
];

function generateProductText(
  seed: string,
  index: number,
  category: Category,
  brand: string,
  params: GeneratedParam[]
): {
  nameUa: string;
  descriptionUa: string;
} {
  const random = createSeededRandom(
    `${seed}:text:${index}:${category.portal_id}`
  );

  const importantParams =
  	PRODUCT_NAME_PARAM_PRIORITY
      .map((priorityName) =>
        params.find(
          (param) =>
          	param.name === priorityName &&
          	param.values.some(
              (value) => value.trim().length > 0
          	)
      	)
      )
      .filter(
      	(param): param is GeneratedParam =>
          param !== undefined
      )
      .slice(0, 3)
      .flatMap(
      	(param) =>
          param.values
          	.filter(
              (value) => value.trim().length > 0
          	)
          	.slice(0, 1)
      );

  const suffix =
    importantParams.length > 0
      ? ` ${importantParams.join(" ")}`
      : "";

  const nameVariants = [
  	`${category.nameUK} ${brand}${suffix}`,
  	`${brand} ${category.nameUK}${suffix}`,
  	`${category.nameUK} ${brand}${suffix} ${index + 1}`,
  	`${brand} ${category.nameUK} ${index + 1}${suffix}`,
  	`${category.nameUK}${suffix} від ${brand}`,
  ];

  const nameUa =
    `${pickOne(random, nameVariants)} TEST-${index + 1}`;

  const descriptionUa =
    `${nameUa}. Тестовий товар категорії "${category.nameUK}". ` +
    `Основні характеристики: ${
	  params.length > 0
  		? [
      		...PRODUCT_NAME_PARAM_PRIORITY
        	  .map((priorityName) =>
          		params.find(
            	  (param) =>
              		param.name === priorityName &&
    				param.values.some(
      				  (value) => value.trim().length > 0
    				)
          		)
        	  )
        	  .filter(
          		(param): param is GeneratedParam =>
            	  param !== undefined
        	  ),
      		...params.filter(
        	  (param) =>
          		!PRODUCT_NAME_PARAM_PRIORITY.includes(
            	  param.name
          		) &&
    			param.values.some(
      			  (value) => value.trim().length > 0
    			)
      		),
    	  ]
      		.slice(0, 6)
      		.map(
        	  (param) =>
          		`${param.name}: ${param.values
      			  .filter(
        			(value) => value.trim().length > 0
      			  )
      			  .join(", ")}`
      		)
      		.join("; ")
  		: "не вказані"
    }.`;

  return {
    nameUa,
    descriptionUa,
  };
}

function generateBaselineProduct(
  seed: string,
  index: number,
  category: Category,
  oversizedImage: boolean
): GeneratedProduct {
  const vendor = generateBrand(seed, index);
  const country = generateCountry(seed, index);

  const params = generateParamsForCategory(
    seed,
    index,
    category
  );

  const text = generateProductText(
    seed,
    index,
    category,
    vendor,
    params
  );

  const price = generatePrice(seed, index);

  return {
    id: generateProductId(seed, index),
    available: true,

    nameUa: text.nameUa,
    nameRu: text.nameUa,

    descriptionUa: text.descriptionUa,
    descriptionRu: text.descriptionUa,

    price,
    oldPrice: generateOldPrice(
      seed,
      index,
      price
    ),

    categoryId: generateCategoryId(
      seed,
      category.portal_id
    ),

    categoryName: category.nameUK,
    portalId: category.portal_id,

    vendor,
    country,

    temperatureMode: "cooling",

    pictures: oversizedImage
  	  ? [OVERSIZED_IMAGE_URL]
  	  : generatePictures(seed, index),

    params,
  };
}

function generateBaselineProducts(
  seed: string,
  count: number,
  requestedPortalIds: string[],
  oversizedImage: boolean
): GeneratedProduct[] {
  const categoryRandom = createSeededRandom(
    `${seed}:categories`
  );

  const selectedCategories = selectCategories(
    categoryRandom,
    requestedPortalIds,
    count
  );

  return selectedCategories.map(
    (category, index) =>
      generateBaselineProduct(
        seed,
        index,
        category,
		oversizedImage
      )
  );
}

function generateChangedCategoryProduct(
  seed: string,
  index: number,
  product: GeneratedProduct
): GeneratedProduct {
  const alternatives = categories.filter(
    (category) =>
      category.portal_id !== product.portalId
  );

  if (alternatives.length === 0) {
    return product;
  }

  const random = createSeededRandom(
    `${seed}:changed-category:${index}`
  );

  const newCategory = pickOne(
    random,
    alternatives
  );

  const newParams = generateParamsForCategory(
    `${seed}:changed-category`,
    index,
    newCategory
  );

  return {
    ...product,

    categoryId: generateCategoryId(
      `${seed}:changed-category`,
      newCategory.portal_id
    ),

    categoryName: newCategory.nameUK,
    portalId: newCategory.portal_id,

    params: newParams,
  };
}

function applyChanges(
  seed: string,
  changeSeed: string,
  products: GeneratedProduct[],
  changeFields: string[],
  changeCharacteristics: string[]
): GeneratedProduct[] {
  return products.map((product, index) => {
    let updatedProduct = {
      ...product,
      params: product.params.map((param) => ({
        ...param,
        values: [...param.values],
      })),
      pictures: [...product.pictures],
    };

    if (changeFields.includes("price")) {
      const newPrice = generateChangedPrice(
        `${seed}:change:${changeSeed}`,
        index,
        product.price
      );

      updatedProduct.price = newPrice;

      updatedProduct.oldPrice =
        generateChangedOldPrice(
          `${seed}:change:${changeSeed}`,
          index,
          newPrice,
          product.oldPrice
        );
    }

    if (changeFields.includes("brand")) {
      updatedProduct.vendor =
        generateChangedBrand(
          `${seed}:change:${changeSeed}`,
          index,
          product.vendor
        );
    }

    if (changeFields.includes("country")) {
      updatedProduct.country =
        generateChangedCountry(
          `${seed}:change:${changeSeed}`,
          index,
          product.country
        );
    }

    if (changeFields.includes("images")) {
      updatedProduct.pictures =
        generateChangedPictures(
          `${seed}:change:${changeSeed}`,
          index,
          product.pictures
        );
    }

	if (changeFields.includes("category")) {
 	  updatedProduct =
    	generateChangedCategoryProduct(
      	  `${seed}:change:${changeSeed}`,
      	  index,
      	  updatedProduct
    	);
	}

	const currentCategory = categories.find(
  	  (item) =>
    	item.portal_id === updatedProduct.portalId
	);

	if (changeFields.includes("characteristics")) {

  	  if (currentCategory) {
    	updatedProduct.params =
      	  updatedProduct.params.map((param) =>
        	generateChangedParam(
          	  `${seed}:change:${changeSeed}`,
          	  index,
          	  currentCategory,
          	  param
        	)
      	  );
  		}
	}

	if (
	  !changeFields.includes("characteristics") &&
  	  changeCharacteristics.length > 0
	) {

  	  if (currentCategory) {
    	updatedProduct.params =
      	  updatedProduct.params.map((param) => {
        	if (
        	  !changeCharacteristics.includes(
            	param.name
          	  )
        	) {
          	  return param;
        	}

        	return generateChangedParam(
          	  `${seed}:change:${changeSeed}`,
          	  index,
          	  currentCategory,
          	  param
        	);
      	  });
  		}
	}

    return updatedProduct;
  });
}

function applySetCharacteristics(
  products: GeneratedProduct[],
  setCharacteristics: {
    name: string;
    value: string;
  }[]
): GeneratedProduct[] {
  if (setCharacteristics.length === 0) {
    return products;
  }

  return products.map((product) => {
    const updatedParams =
      product.params.map((param) => {
        const override =
          setCharacteristics.find(
            (item) =>
              item.name === param.name
          );

        if (!override) {
          return param;
        }

        return {
          ...param,
          values: [override.value],
        };
      });

    return {
      ...product,
      params: updatedParams,
    };
  });
}

function applyBlankAndNone(
  seed: string,
  changeSeed: string,
  products: GeneratedProduct[],
  blankCharacteristics: string[],
  blankPercent: number,
  noneCharacteristics: string[],
  nonePercent: number
): GeneratedProduct[] {
  return products.map((product, index) => {
  	const updatedParams = product.params
      .filter((param) => {
      	if (
          !noneCharacteristics.includes(param.name)
      	) {
          return true;
      	}

        const randomNone = createSeededRandom(
          `${seed}:change:${changeSeed}:none:${index}:${param.name}`
      	);

        const shouldRemove =
          randomNone() * 100 < nonePercent;

      	return !shouldRemove;
      })
      .map((param) => {
      	if (
          !blankCharacteristics.includes(param.name)
      	) {
          return param;
      	}

      	const randomBlank = createSeededRandom(
          `${seed}:change:${changeSeed}:blank:${index}:${param.name}`
      	);

      	const shouldBlank =
          randomBlank() * 100 < blankPercent;

      	if (!shouldBlank) {
          return param;
      	}

      	return {
          ...param,
          values: [""],
      	};
      });

  	return {
      ...product,
      params: updatedParams,
  	};
  });
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function generateParamsXml(
  product: GeneratedProduct
): string {
  return product.params
    .flatMap((param) =>
      param.values.map(
        (value) =>
          `        <param name="${escapeXml(param.name)}">${escapeXml(value)}</param>`
      )
    )
    .join("\n");
}

function generatePicturesXml(
  product: GeneratedProduct
): string {
  return product.pictures
    .map(
      (picture) =>
        `        <picture>${escapeXml(picture)}</picture>`
    )
    .join("\n");
}

type SetFieldOverride = {
  name: string;
  value: string;
};

function generateOfferFieldXml(
  fieldName: string,
  value: string | number,
  blankFields: string[],
  noneFields: string[],
  setFields: SetFieldOverride[]
): string {
  if (noneFields.includes(fieldName)) {
    return "";
  }

  if (blankFields.includes(fieldName)) {
    return `        <${fieldName}></${fieldName}>`;
  }

  const override = setFields.find(
    (item) => item.name === fieldName
  );

  const finalValue =
    override?.value ?? value;

  return `        <${fieldName}>${escapeXml(String(finalValue))}</${fieldName}>`;
}

function generateOfferXml(
  product: GeneratedProduct,
  blankFields: string[],
  noneFields: string[],
  setFields: SetFieldOverride[]
): string {
  return `      <offer id="${product.id}" available="${product.available}">
  ${generateOfferFieldXml("name_ua", product.nameUa, blankFields, noneFields, setFields)}
  ${generateOfferFieldXml("name_ru", product.nameRu, blankFields, noneFields, setFields)}

  ${generateOfferFieldXml("description_ua", product.descriptionUa, blankFields, noneFields, setFields)}
  ${generateOfferFieldXml("description_ru", product.descriptionRu, blankFields, noneFields, setFields)}

  ${generateOfferFieldXml("price", product.price, blankFields, noneFields, setFields)}
  ${generateOfferFieldXml("old_price", product.oldPrice, blankFields, noneFields, setFields)}

  ${generateOfferFieldXml("categoryId", product.categoryId, blankFields, noneFields, setFields)}

  ${generateOfferFieldXml("vendor", product.vendor, blankFields, noneFields, setFields)}
  ${generateOfferFieldXml("country", product.country, blankFields, noneFields, setFields)}

  ${generateOfferFieldXml("temperature_mode", product.temperatureMode, blankFields, noneFields, setFields)}

  ${generatePicturesXml(product)}

  ${generateParamsXml(product)}
      </offer>`;
}

function generateCategoriesXml(
  products: GeneratedProduct[]
): string {
  const uniqueCategories = new Map<
    string,
    {
      categoryId: number;
      categoryName: string;
      portalId: string;
    }
  >();

  for (const product of products) {
    const key =
      `${product.categoryId}-${product.portalId}`;

    if (!uniqueCategories.has(key)) {
      uniqueCategories.set(key, {
        categoryId: product.categoryId,
        categoryName: product.categoryName,
        portalId: product.portalId,
      });
    }
  }

  return Array.from(uniqueCategories.values())
    .map(
      (category) =>
        `      <category id="${category.categoryId}" portal_id="${category.portalId}">${escapeXml(category.categoryName)}</category>`
    )
    .join("\n");
}

export default {
  async fetch(request): Promise<Response> {
    const url = new URL(request.url);

	if (url.pathname !== "/products.xml") {
  	  return new Response("Not Found", {
    	status: 404,
  	  });
	}

	const countParam =
  	  url.searchParams.get("count");

	const count =
  	  countParam === null
    	? 10
    	: Number(countParam);

	if (
  	  !Number.isInteger(count) ||
  	  count < 1 ||
  	  count > 100
	) {
  	  return new Response(
    	"count must be an integer from 1 to 100",
    	{
      	  status: 400,
    	}
  	  );
	}

	const requestedPortalIds = [
  	  ...new Set(
    	(url.searchParams.get("categories") ?? "")
      	  .split(",")
      	  .map((value) => value.trim())
      	  .filter(Boolean)
  	  ),
	];

	const idSeedParam =
  	  url.searchParams.get("idSeed");

	const idSeed =
  	  idSeedParam === null
    	? `random-${crypto.randomUUID()}`
    	: idSeedParam.trim();

	if (idSeed.length === 0) {
  	  return new Response(
    	"idSeed must not be empty",
    	{
      		status: 400,
    	}
  	  );
	}

	const oversizedImageParam =
  	  url.searchParams.get("oversizedImage");

	if (
  	  oversizedImageParam !== null &&
  	  oversizedImageParam !== "true" &&
  	  oversizedImageParam !== "false"
	) {
  	  return new Response(
    	"oversizedImage must be either true or false",
    	  {
      		status: 400,
    	  }
  	  );
	}

	const oversizedImage =
  	  oversizedImageParam === "true";

	const invalidPortalIds =
  		requestedPortalIds.filter(
    		(portalId) =>
      			!categories.some(
        			(category) =>
          				category.portal_id === portalId
      			)
  		);

	if (invalidPortalIds.length > 0) {
  		return new Response(
    		`Unknown portal_id: ${invalidPortalIds.join(", ")}`,
    			{
      				status: 400,
    			}
  		);
	}

	if (
  	  requestedPortalIds.length > 0 &&
  	  count < requestedPortalIds.length
	) {
  	  return new Response(
    	`count must be at least ${requestedPortalIds.length} when ${requestedPortalIds.length} categories are requested`,
    	{
      	  status: 400,
    	}
  	  );
	}

	const changeFields = [
  	  ...new Set(
    	(url.searchParams.get("change") ?? "")
      	  .split(",")
      	  .map((value) => value.trim())
      	  .filter(Boolean)
  	  ),
	];

	const changeSeedParam =
  	  url.searchParams.get("changeSeed");

	const changeSeed =
  	  changeSeedParam === null
      ? "1"
      : changeSeedParam.trim();

	if (changeSeed.length === 0) {
  	  return new Response(
    	"changeSeed must not be empty",
    	  {
      		status: 400,
    	  }
  	  );
	}

	const supportedChangeFields = [
  	  "price",
  	  "brand",
  	  "country",
 	  "images",
  	  "category",
  	  "characteristics",
	];
	
	const invalidChangeFields =
  	  changeFields.filter(
    	(field) =>
      	  !supportedChangeFields.includes(field)
  	  );

	if (invalidChangeFields.length > 0) {
  	  return new Response(
    	`Unknown change field: ${invalidChangeFields.join(", ")}`,
    	{
      	  status: 400,
    	}
  	  );
	}

	if (
  	  oversizedImage &&
  	  changeFields.includes("images")
	) {
  	  return new Response(
    	"oversizedImage=true cannot be combined with change=images",
    	{
      		status: 400,
    	}
  	  );
	}

	const changeCharacteristics = [
  	  ...new Set(
    	(url.searchParams.get("changeCharacteristic") ?? "")
      	  .split(",")
      	  .map((value) => value.trim())
      	  .filter(Boolean)
  	  ),
	];

  const setCharacteristicParams =
    url.searchParams.getAll("setCharacteristic");

  const setCharacteristics = setCharacteristicParams.map(
    (entry) => {
      const separatorIndex = entry.indexOf(":");

      if (separatorIndex <= 0) {
        return null;
      }

      const name = entry
        .slice(0, separatorIndex)
        .trim();

      const value = entry
        .slice(separatorIndex + 1)
        .trim();

      if (
        name.length === 0 ||
        value.length === 0
      ) {
        return null;
      }

      return {
        name,
        value,
      };
    }
  );

  if (
    setCharacteristics.some(
      (item) => item === null
    )
  ) {
    return new Response(
      "setCharacteristic must use format Characteristic:Value",
      {
        status: 400,
      }
    );
  }

	if (
  	  changeFields.includes("category") &&
  	  changeCharacteristics.length > 0
	) {
  	  return new Response(
    	"changeCharacteristic cannot be combined with change=category",
    	{
      		status: 400,
    	}
  	  );
	}
	
	const blankCharacteristics = [
  	  ...new Set(
    	(url.searchParams.get("blank") ?? "")
      	  .split(",")
      	  .map((value) => value.trim())
      	  .filter(Boolean)
  	  ),
	];

	const noneCharacteristics = [
  	  ...new Set(
    	(url.searchParams.get("none") ?? "")
      	  .split(",")
      	  .map((value) => value.trim())
      	  .filter(Boolean)
  	  ),
	];

	const blankPercentParam =
  	  url.searchParams.get("blankPercent");

	const blankPercent =
  	  blankPercentParam === null
      	? 100
      	: Number(blankPercentParam);
  

	if (
  	  !Number.isFinite(blankPercent) ||
  	  blankPercent < 0 ||
  	  blankPercent > 100
	) {
  	  return new Response(
    	"blankPercent must be a number from 0 to 100",
    	{
      	  status: 400,
    	}
  	  );
	}

	const nonePercentParam =
  	  url.searchParams.get("nonePercent");

	const nonePercent =
  	  nonePercentParam === null
      ? 100
      : Number(nonePercentParam);

	if (
  	  !Number.isFinite(nonePercent) ||
  	  nonePercent < 0 ||
  	  nonePercent > 100
	) {
  	  return new Response(
    	"nonePercent must be a number from 0 to 100",
    	{
      	  status: 400,
    	}
  	  );
	}

  const supportedOfferFields = [
    "name_ua",
    "name_ru",
    "description_ua",
    "description_ru",
    "price",
    "old_price",
    "categoryId",
    "vendor",
    "country",
    "temperature_mode",
  ];

  const blankFields = [
    ...new Set(
      (url.searchParams.get("blankField") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ];

  const noneFields = [
    ...new Set(
      (url.searchParams.get("noneField") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ];

  const invalidBlankFields =
    blankFields.filter(
      (field) =>
        !supportedOfferFields.includes(field)
    );

  if (invalidBlankFields.length > 0) {
    return new Response(
      `Unknown blankField: ${invalidBlankFields.join(", ")}`,
      {
        status: 400,
      }
    );
  }

  const invalidNoneFields =
    noneFields.filter(
      (field) =>
        !supportedOfferFields.includes(field)
    );

  if (invalidNoneFields.length > 0) {
    return new Response(
      `Unknown noneField: ${invalidNoneFields.join(", ")}`,
      {
        status: 400,
      }
    );
  }

  const conflictingOfferFields =
    blankFields.filter(
      (field) =>
        noneFields.includes(field)
    );

  if (conflictingOfferFields.length > 0) {
    return new Response(
      `Field cannot be both blank and none: ${conflictingOfferFields.join(", ")}`,
      {
        status: 400,
      }
    );
  }

  const setFieldParams =
    url.searchParams.getAll("setField");

  const setFields = setFieldParams.map(
    (entry) => {
      const separatorIndex = entry.indexOf(":");

      if (separatorIndex <= 0) {
        return null;
      }

      const name = entry
        .slice(0, separatorIndex)
        .trim();

      const value = entry
        .slice(separatorIndex + 1)
        .trim();

      if (
        name.length === 0 ||
        value.length === 0
      ) {
        return null;
      }

      return {
        name,
        value,
      };
    }
  );

  if (
    setFields.some(
      (item) => item === null
    )
  ) {
    return new Response(
      "setField must use format Field:Value",
      {
        status: 400,
      }
    );
  }

  const validSetFields =
    setFields.filter(
      (item): item is SetFieldOverride =>
        item !== null
    );

  const setFieldNames =
    validSetFields.map(
      (item) => item.name
    );

  const invalidSetFields =
    setFieldNames.filter(
      (field) =>
        !supportedOfferFields.includes(field)
    );

  if (invalidSetFields.length > 0) {
    return new Response(
      `Unknown setField: ${[
        ...new Set(invalidSetFields),
      ].join(", ")}`,
      {
        status: 400,
      }
    );
  }

  const setBlankFieldConflicts =
    setFieldNames.filter(
      (field) =>
        blankFields.includes(field)
    );

  if (setBlankFieldConflicts.length > 0) {
    return new Response(
      `Field cannot be both set and blank: ${[
        ...new Set(setBlankFieldConflicts),
      ].join(", ")}`,
      {
        status: 400,
      }
    );
  }

  const setNoneFieldConflicts =
    setFieldNames.filter(
      (field) =>
        noneFields.includes(field)
    );

  if (setNoneFieldConflicts.length > 0) {
    return new Response(
      `Field cannot be both set and none: ${[
        ...new Set(setNoneFieldConflicts),
      ].join(", ")}`,
      {
        status: 400,
      }
    );
  }

  const setCharacteristicNames =
    setCharacteristics
      .filter(
        (
          item
        ): item is {
          name: string;
          value: string;
        } => item !== null
      )
      .map((item) => item.name);

  if (
    changeFields.includes("category") &&
    setCharacteristicNames.length > 0
  ) {
    return new Response(
      "setCharacteristic cannot be combined with change=category",
      {
        status: 400,
      }
    );
  }

  const requestedCharacteristicNames = [
    ...changeCharacteristics,
    ...blankCharacteristics,
    ...noneCharacteristics,
    ...setCharacteristicNames,
  ];

	const invalidCharacteristicNames =
  	  requestedCharacteristicNames.filter(
    	(name) => !characteristicExists(name)
  	  );

	if (invalidCharacteristicNames.length > 0) {
  	  return new Response(
    	`Unknown characteristic: ${[
      	...new Set(invalidCharacteristicNames),
    	].join(", ")}`,
    	{
      	  status: 400,
    	}
  	  );
	}

	if (requestedPortalIds.length > 0) {
  	  const selectedCategories = categories.filter(
    	(category) =>
      	  requestedPortalIds.includes(category.portal_id)
  	  );

  	  const selectedCharacteristicNames =
    	new Set(
      	  selectedCategories.flatMap((category) =>
        	getCategoryAttributes(category)
              .map(
            	(attribute) =>
              	  attribute.nameUK
          	  )
      	  )
    	);

  	  const unavailableCharacteristicNames =
    	requestedCharacteristicNames.filter(
      	  (name) =>
        	!selectedCharacteristicNames.has(name)
    	);

  	  if (unavailableCharacteristicNames.length > 0) {
    	return new Response(
      	  `Characteristic is not available in selected categories: ${[
        	...new Set(
          	  unavailableCharacteristicNames
        	),
      	  ].join(", ")}`,
      	  {
        	status: 400,
      	  }
    	);
  	  }
	}

	const conflictingCharacteristics =
  	  blankCharacteristics.filter(
    	(name) => noneCharacteristics.includes(name)
  	  );

	if (conflictingCharacteristics.length > 0) {
  	  return new Response(
    	`Characteristic cannot be both blank and none: ${conflictingCharacteristics.join(", ")}`,
      	{
      		status: 400,
      	}
  	  );
	}

  const setBlankConflicts =
    setCharacteristicNames.filter(
      (name) =>
        blankCharacteristics.includes(name)
    );

  if (setBlankConflicts.length > 0) {
    return new Response(
      `Characteristic cannot be both set and blank: ${[
        ...new Set(setBlankConflicts),
      ].join(", ")}`,
      {
        status: 400,
      }
    );
  }

  const setNoneConflicts =
    setCharacteristicNames.filter(
      (name) =>
        noneCharacteristics.includes(name)
    );

  if (setNoneConflicts.length > 0) {
    return new Response(
      `Characteristic cannot be both set and none: ${[
        ...new Set(setNoneConflicts),
      ].join(", ")}`,
      {
        status: 400,
      }
    );
  }

	const baselineProducts = generateBaselineProducts(
  		idSeed,
  		count,
  		requestedPortalIds,
  		oversizedImage
	);

	const changedProducts = applyChanges(
    idSeed,
    changeSeed,
    baselineProducts,
    changeFields,
    changeCharacteristics
  );

  const setProducts = applySetCharacteristics(
    changedProducts,
    setCharacteristics.filter(
      (
        item
      ): item is {
        name: string;
        value: string;
      } => item !== null
    )
  );

  const generatedProducts = applyBlankAndNone(
    idSeed,
    changeSeed,
    setProducts,
    blankCharacteristics,
    blankPercent,
    noneCharacteristics,
    nonePercent
  );

	const offersXml = generatedProducts
		.map((product) =>
      generateOfferXml(
        product,
        blankFields,
        noneFields,
        validSetFields
      )
    )
		.join("\n");

	const categoriesXml = generateCategoriesXml(
  		generatedProducts
	);

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
	<!-- idSeed=${escapeXml(idSeed)} changeSeed=${escapeXml(changeSeed)} -->
	<yml_catalog>
  	  <shop>
    	<categories>
	${categoriesXml}
    	</categories>

    	<products_count>${generatedProducts.length}</products_count>

    	<offers>
	${offersXml}
    	</offers>
	  </shop>
	</yml_catalog>`;

	return new Response(xml, {
	  headers: {
    	"Content-Type": "application/xml; charset=UTF-8",
    	"Cache-Control": "no-store",
    	"X-Robots-Tag": "noindex",
		"X-Id-Seed": idSeed,
		"X-Change-Seed": changeSeed,
  	  },
	});
  },
} satisfies ExportedHandler<Env>;
