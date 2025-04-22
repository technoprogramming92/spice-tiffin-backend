import { z } from "zod";

export const createPackageSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.number().min(0),
  type: z.enum(["trial", "weekly", "monthly"]),
  image: z.string().optional(),
});

export const updatePackageSchema = createPackageSchema.partial();
