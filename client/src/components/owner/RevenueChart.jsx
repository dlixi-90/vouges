import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatThousandsVnd } from "../../utils/money";
import { memo } from "react";

const RevenueChart = ({ data, currency }) => (
  <ResponsiveContainer width="100%" height={360} minWidth={0}>
    <BarChart data={data}>
      <CartesianGrid vertical={false} stroke="#e9edef" />
      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#7d8792", fontSize: 12 }} />
      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#7d8792", fontSize: 12 }} />
      <Tooltip formatter={(value) => formatThousandsVnd(value, currency)} cursor={{ fill: "#f4f6f5" }} />
      <Legend />
      <Bar dataKey="total" name="Total" fill="#9fc4a9" radius={[4, 4, 0, 0]} isAnimationActive={false} />
      <Bar dataKey="successful" name="Paid" fill="#263b4a" radius={[4, 4, 0, 0]} isAnimationActive={false} />
    </BarChart>
  </ResponsiveContainer>
);

export default memo(RevenueChart);
