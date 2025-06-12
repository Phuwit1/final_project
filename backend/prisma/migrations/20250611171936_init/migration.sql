-- CreateTable
CREATE TABLE "Customer" (
    "customer_id" SERIAL NOT NULL,
    "first_name" VARCHAR(50) NOT NULL,
    "last_name" VARCHAR(50) NOT NULL,
    "email" VARCHAR(50) NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "TripGroup" (
    "trip_id" SERIAL NOT NULL,
    "owner_id" INTEGER NOT NULL,
    "name_group" VARCHAR(50) NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripGroup_pkey" PRIMARY KEY ("trip_id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "group_member_id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "trip_id" INTEGER NOT NULL,
    "joinAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("group_member_id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "budget_id" SERIAL NOT NULL,
    "trip_id" INTEGER NOT NULL,
    "total_budget" INTEGER NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("budget_id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "expense_id" SERIAL NOT NULL,
    "budget_id" INTEGER NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "create_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("expense_id")
);

-- CreateTable
CREATE TABLE "TripPlan" (
    "plan_id" SERIAL NOT NULL,
    "trip_id" INTEGER NOT NULL,
    "start_plan_date" DATE NOT NULL,
    "end_plan_date" DATE NOT NULL,
    "day_of_trip" INTEGER NOT NULL,
    "creat_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripPlan_pkey" PRIMARY KEY ("plan_id")
);

-- CreateTable
CREATE TABLE "TripSchedule" (
    "schedule_id" SERIAL NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "time" TIME NOT NULL,
    "activity" VARCHAR(300) NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "creat_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripSchedule_pkey" PRIMARY KEY ("schedule_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_customer_id_trip_id_key" ON "GroupMember"("customer_id", "trip_id");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_trip_id_key" ON "Budget"("trip_id");

-- AddForeignKey
ALTER TABLE "TripGroup" ADD CONSTRAINT "TripGroup_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "Customer"("customer_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("customer_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "TripGroup"("trip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "TripGroup"("trip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "Budget"("budget_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPlan" ADD CONSTRAINT "TripPlan_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "TripGroup"("trip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripSchedule" ADD CONSTRAINT "TripSchedule_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "TripPlan"("plan_id") ON DELETE CASCADE ON UPDATE CASCADE;
