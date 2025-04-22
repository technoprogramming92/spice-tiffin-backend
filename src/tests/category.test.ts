import request from "supertest";
import app from "../app"; // Express instance
import mongoose from "mongoose";

let token: string;

beforeAll(async () => {
  // authenticate as admin (mock or real token)
  token = "Bearer <mock_or_real_token>";
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe("Category API", () => {
  let categoryId = "";

  it("should create a category", async () => {
    const res = await request(app)
      .post("/api/v1/categories")
      .set("Authorization", token)
      .send({ name: "Test Category" });

    expect(res.statusCode).toBe(201);
    expect(res.body.category).toHaveProperty("_id");
    categoryId = res.body.category._id;
  });

  it("should fetch all categories", async () => {
    const res = await request(app).get("/api/v1/categories");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("should update a category", async () => {
    const res = await request(app)
      .put(`/api/v1/categories/${categoryId}`)
      .set("Authorization", token)
      .send({ name: "Updated Category" });

    expect(res.statusCode).toBe(200);
    expect(res.body.category.name).toBe("Updated Category");
  });

  it("should delete a category", async () => {
    const res = await request(app)
      .delete(`/api/v1/categories/${categoryId}`)
      .set("Authorization", token);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Category deleted");
  });
});
