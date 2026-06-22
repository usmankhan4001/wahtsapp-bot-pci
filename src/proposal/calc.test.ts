import { describe, it, expect } from "vitest";
import { calculatePlan, type PlanInput } from "./calc.js";

describe("calculatePlan", () => {
  it("calculates full plan correctly", () => {
    const input: PlanInput = { totalPrice: 100000, plan: "full" };
    const res = calculatePlan(input);
    expect(res.plan).toBe("full");
    expect(res.totalPrice).toBe(100000);
    expect(res.downPaymentAmount).toBe(0);
    expect(res.possessionAmount).toBe(0);
    expect(res.remainingForInstallment).toBe(0);
    expect(res.schedule).toEqual([]);
  });

  it("calculates basic installment plan with defaults", () => {
    const input: PlanInput = { totalPrice: 100000, plan: "installment" };
    const res = calculatePlan(input);
    expect(res.plan).toBe("installment");
    expect(res.totalPrice).toBe(100000);
    expect(res.downPaymentPercent).toBe(50);
    expect(res.downPaymentAmount).toBe(50000);
    expect(res.possessionPercent).toBe(10);
    expect(res.possessionAmount).toBe(10000);
    expect(res.totalBalloon).toBe(0);
    expect(res.installmentMonths).toBe(6);
    expect(res.remainingForInstallment).toBe(40000);
    
    // Average installment should be 40000 / 6
    expect(res.averageInstallment).toBeCloseTo(6666.67, 1);
    expect(res.schedule.length).toBe(6);
    expect(res.schedule[0].amount).toBeCloseTo(6666.67, 1);
  });

  it("calculates balloons correctly", () => {
    const input: PlanInput = {
      totalPrice: 120000,
      plan: "installment",
      downPaymentPercent: 30, // 36k
      possessionPercent: 10,  // 12k
      installmentMonths: 12,
      balloons: [
        { month: 6, amount: 12000 },
        { month: 12, amount: 12000 }
      ]
    };
    const res = calculatePlan(input);
    // price = 120k
    // DP = 36k
    // Poss = 12k
    // Balloons = 24k
    // Base per-installment before balloon = (120k - 36k - 12k) / 12 = 72k / 12 = 6000
    // First 6 months: balloon 12k over 6 mo -> deduction 2000 -> amount = 4000
    // Next 6 months: balloon 12k over 6 mo -> deduction 2000 -> amount = 4000
    expect(res.downPaymentAmount).toBe(36000);
    expect(res.possessionAmount).toBe(12000);
    expect(res.totalBalloon).toBe(24000);
    expect(res.remainingForInstallment).toBe(48000);

    const installments = res.schedule.filter(s => s.kind === "installment");
    const balloonPayments = res.schedule.filter(s => s.kind === "balloon");
    
    expect(installments.length).toBe(12);
    expect(installments[0].amount).toBe(4000);
    expect(installments[11].amount).toBe(4000);

    expect(balloonPayments.length).toBe(2);
    expect(balloonPayments[0].month).toBe(6);
    expect(balloonPayments[0].amount).toBe(12000);
  });
});
