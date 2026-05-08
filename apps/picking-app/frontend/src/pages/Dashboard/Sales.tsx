import PageMeta from "../../components/common/PageMeta";
import SalesChannel from "../../components/sales/sales-channel";
import SalesChannelCountry from "../../components/sales/sales-channel-country";
import UserRetentionTable from "../../components/sales/sales-country-table";
import SalesStats from "../../components/sales/sales-stats";
import TopProductTable from "../../components/sales/top-product";
import UserRevenueAndStats from "../../components/sales/user-revenue-and-stats-chart";

export default function SalesDashboard() {
  return (
    <>
      <PageMeta
        title="React.js Sales Dashboard | TailAdmin - React.js Admin Dashboard Template"
        description="This is React.js Sales Dashboard page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <div className="space-y-6">
        <SalesStats />
        <UserRevenueAndStats />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <UserRetentionTable />
          <SalesChannel />
          <SalesChannelCountry />
        </div>
        <TopProductTable />
      </div>
    </>
  );
}
