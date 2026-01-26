-- CreateTable
CREATE TABLE "CacheAttraction" (
    "attraction_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "google_place_id" VARCHAR(100) NOT NULL,
    "rating" DOUBLE PRECISION DEFAULT 0.0,
    "review_count" INTEGER DEFAULT 0,
    "photo_ref" VARCHAR(255),
    "address" TEXT,
    "last_fetched_at" TIMESTAMP(3),
    "city_id" INTEGER NOT NULL,

    CONSTRAINT "CacheAttraction_pkey" PRIMARY KEY ("attraction_id")
);

-- CreateTable
CREATE TABLE "City" (
    "city_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("city_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CacheAttraction_google_place_id_key" ON "CacheAttraction"("google_place_id");

-- CreateIndex
CREATE UNIQUE INDEX "City_name_key" ON "City"("name");

-- AddForeignKey
ALTER TABLE "CacheAttraction" ADD CONSTRAINT "CacheAttraction_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "City"("city_id") ON DELETE RESTRICT ON UPDATE CASCADE;
