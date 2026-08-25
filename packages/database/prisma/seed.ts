import { db } from "../src/index.js";
const user = await db.user.upsert({
  where: { email: "demo@chief.local" },
  update: {},
  create: {
    email: "demo@chief.local",
    name: "Zunair",
    emailVerified: true,
    settings: { create: { timezone: "Asia/Karachi" } },
  },
});
await db.task.createMany({
  data: [
    {
      userId: user.id,
      title: "Review product proposal",
      priority: "URGENT",
      source: "SEED",
      dueAt: new Date(Date.now() + 86400000),
    },
    {
      userId: user.id,
      title: "Send interview availability",
      priority: "HIGH",
      source: "SEED",
      createdByAi: true,
    },
  ],
});
await db.$disconnect();
