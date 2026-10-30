import unittest

from update_products import make_product


class ProductEnrichmentTests(unittest.TestCase):
    def test_womens_apparel_is_not_misclassified_as_mens(self):
        product = make_product({
            "id": 63,
            "name": "Women's Printed Kurti",
            "price": 999,
            "oldPrice": 1499,
            "category": "fashion",
            "image": "images/shirt2.jpeg",
        })

        self.assertEqual(product["specifications"]["gender"], "Women")
        self.assertIn("gender: Women", product["features"])

    def test_womens_shoes_have_the_correct_gender(self):
        product = make_product({
            "id": 106,
            "name": "Women's Casual Sneakers",
            "price": 1799,
            "oldPrice": 2499,
            "category": "shoes",
            "image": "images/shoe2.jpeg",
        })

        self.assertEqual(product["specifications"]["gender"], "Women")
        self.assertNotIn("s", product["searchKeywords"])

    def test_preserves_catalog_fields_and_existing_warranty(self):
        source = {
            "id": 1,
            "name": "Wireless Bluetooth Headphones",
            "price": 1299,
            "oldPrice": 1999,
            "category": "electronics",
            "image": "images/earphonemain.jpeg",
            "warranty": "As listed by seller",
            "additionalField": "preserve",
        }

        product = make_product(source)

        for field in ("id", "name", "price", "oldPrice", "category", "image"):
            self.assertEqual(product[field], source[field])
        self.assertEqual(product["warranty"], source["warranty"])
        self.assertEqual(product["additionalField"], source["additionalField"])

    def test_preserves_existing_non_null_specifications(self):
        source = {
            "id": 6,
            "name": "casual shirt",
            "price": 799,
            "oldPrice": 1299,
            "category": "fashion",
            "image": "images/shirt.jpeg",
            "specifications": {
                "garmentType": "casual shirt",
                "gender": "Men",
                "material": None,
            },
        }

        product = make_product(source)

        self.assertEqual(product["specifications"]["gender"], "Men")
        self.assertIsNone(product["specifications"]["material"])

    def test_known_samsung_model_uses_catalogued_details_without_fake_warranty(self):
        product = make_product({
            "id": 8,
            "name": "Samsung Galaxy S26 ultra",
            "price": 159999,
            "oldPrice": 189999,
            "category": "mobiles",
            "image": "images/hero4.jpeg",
        })

        self.assertEqual(product["brand"], "Samsung")
        self.assertEqual(product["model"], "Galaxy S26 Ultra")
        self.assertIsNone(product["warranty"])
        self.assertIsNone(product["specifications"]["softwareUpdatePolicy"])

    def test_generic_samsung_galaxy_phone_gets_a_usable_brand_and_model(self):
        product = make_product({
            "id": 32,
            "name": "Samsung Galaxy Smartphone",
            "price": 32999,
            "oldPrice": 38999,
            "category": "mobiles",
            "image": "images/phone.jpeg",
        })

        self.assertEqual(product["brand"], "Samsung")
        self.assertEqual(product["model"], "Galaxy Smartphone")
        self.assertIn("android phone", product["searchKeywords"])
        self.assertIn("handset", product["searchKeywords"])
        self.assertIn("6000mAh", product["specifications"]["batteryCapacity"])
        self.assertIn("unverified", product["warranty"])
        self.assertEqual(product["dataQuality"]["verificationStatus"], "demo_placeholder")

    def test_search_keywords_include_product_and_category_synonyms(self):
        product = make_product({
            "id": 1,
            "name": "Wireless Bluetooth Headphones",
            "price": 1299,
            "oldPrice": 1999,
            "category": "electronics",
            "image": "images/headphones.jpeg",
        })

        self.assertIn("headset", product["searchKeywords"])
        self.assertIn("earbuds", product["searchKeywords"])
        self.assertIn("gadget", product["searchKeywords"])


if __name__ == "__main__":
    unittest.main()
