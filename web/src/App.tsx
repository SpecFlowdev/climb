import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Toasts } from './components/ui';
import { AnalyticsPage } from './pages/Analytics';
import { AssetDetailPage } from './pages/AssetDetail';
import { BudgetsPage } from './pages/Budgets';
import { CategoriesPage } from './pages/Categories';
import { ConvertPage } from './pages/Convert';
import { GoalsPage } from './pages/Goals';
import { MoneyMapPage } from './pages/MoneyMap';
import { RecurringPage } from './pages/Recurring';
import { Dashboard } from './pages/Dashboard';
import { PortfolioPage } from './pages/Portfolio';
import { RulesPage } from './pages/Rules';
import { SettingsPage } from './pages/Settings';
import { TransactionsPage } from './pages/Transactions';
import { WalletsPage } from './pages/Wallets';

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/map" element={<MoneyMapPage />} />
        <Route path="/assets/:symbol" element={<AssetDetailPage />} />
        <Route path="/budgets" element={<BudgetsPage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/recurring" element={<RecurringPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/wallets" element={<WalletsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/convert" element={<ConvertPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
      <Toasts />
    </Layout>
  );
}
