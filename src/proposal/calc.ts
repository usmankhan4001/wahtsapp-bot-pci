// Payment-plan calculation, ported faithfully from the PCI calculator frontend
// (changeTheFinanceFeilds.js + createTableOfInstallments.js).

export interface Balloon {
  month: number;
  amount: number;
}

export interface PlanInput {
  totalPrice: number;
  plan: "full" | "installment";
  /** Down payment %. Default 50, min 30. */
  downPaymentPercent?: number;
  /** On-possession %. Typically 10 or 20. */
  possessionPercent?: number;
  /** Number of monthly installments (6/12/24/36). */
  installmentMonths?: number;
  balloons?: Balloon[];
}

export interface ScheduleRow {
  month: number;
  label: string;
  amount: number;
  kind: "installment" | "balloon";
}

export interface PlanResult {
  plan: "full" | "installment";
  totalPrice: number;
  downPaymentPercent: number;
  downPaymentAmount: number;
  possessionPercent: number;
  possessionAmount: number;
  totalBalloon: number;
  installmentMonths: number;
  /** Remaining spread over installments (price - dp - possession - balloons). */
  remainingForInstallment: number;
  /** Average monthly installment (summary figure). */
  averageInstallment: number;
  schedule: ScheduleRow[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calculatePlan(input: PlanInput): PlanResult {
  const price = input.totalPrice || 0;

  if (input.plan === "full") {
    return {
      plan: "full",
      totalPrice: price,
      downPaymentPercent: 0,
      downPaymentAmount: 0,
      possessionPercent: 0,
      possessionAmount: 0,
      totalBalloon: 0,
      installmentMonths: 0,
      remainingForInstallment: 0,
      averageInstallment: 0,
      schedule: [],
    };
  }

  const dpPct = input.downPaymentPercent ?? 50;
  const possPct = input.possessionPercent ?? 10;
  const months = input.installmentMonths ?? 6;
  const balloons = (input.balloons ?? []).filter((b) => b.month > 0 && b.amount > 0);

  const downPaymentAmount = (price * dpPct) / 100;
  const possessionAmount = (price * possPct) / 100;
  const totalBalloon = balloons.reduce((s, b) => s + b.amount, 0);
  const remainingForInstallment = price - downPaymentAmount - possessionAmount - totalBalloon;

  // Base per-installment BEFORE balloon redistribution (matches the table logic:
  // it divides price - dp - possession, NOT subtracting balloons here).
  const baseInstallment = (price - downPaymentAmount - possessionAmount) / months;

  // Spread each balloon's amount as a deduction across the months in its range
  // (from the previous balloon's month+1 up to its own month).
  const deductionPerRow: Record<number, number> = {};
  const sorted = [...balloons].sort((a, b) => a.month - b.month);
  let prev = 0;
  for (const { month, amount } of sorted) {
    const range = Math.max(1, month - prev);
    const per = amount / range;
    for (let i = prev + 1; i <= month; i++) {
      deductionPerRow[i] = (deductionPerRow[i] || 0) + per;
    }
    prev = month;
  }

  const schedule: ScheduleRow[] = [];
  for (let i = 1; i <= months; i++) {
    const amount = baseInstallment - (deductionPerRow[i] || 0);
    schedule.push({ month: i, label: `Installment ${i}`, amount: r2(amount), kind: "installment" });
    for (const b of balloons.filter((b) => b.month === i)) {
      schedule.push({
        month: i,
        label: `Month ${i} — Balloon Payment`,
        amount: r2(b.amount),
        kind: "balloon",
      });
    }
  }

  return {
    plan: "installment",
    totalPrice: price,
    downPaymentPercent: dpPct,
    downPaymentAmount: r2(downPaymentAmount),
    possessionPercent: possPct,
    possessionAmount: r2(possessionAmount),
    totalBalloon: r2(totalBalloon),
    installmentMonths: months,
    remainingForInstallment: r2(remainingForInstallment),
    averageInstallment: r2(remainingForInstallment / months),
    schedule,
  };
}
