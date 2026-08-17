# Kakobuy Product Title Optimization

The catalog generator now retains the original Kakobuy title field and applies conservative English title normalization. Meaningful source titles are preserved; Chinese source terms are translated into product vocabulary; identifier-like titles such as Catalog Item, Kakobuy Product, ALL-SHP, High Quality 1-TS-001, and pure model codes are replaced with readable category or subcategory titles. Product IDs remain in internal `id` and `sourceProductId` fields only.

The catalog was regenerated with 2,192 grouped products and 1,154 unique source products. TypeScript checks and production build passed. The home grid and a real product detail page were verified with readable English titles, and no `Catalog Item` display titles remain in the generated data.
