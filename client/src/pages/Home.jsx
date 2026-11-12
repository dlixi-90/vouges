import { lazy } from "react";
import Hero from "../components/Hero";
import MobileCategories from "../components/MobileCategories";
import DeferredSection from "../components/DeferredSection";
import CustomerProfileGate from "../components/CustomerProfileGate";
import { EditorialStories, EditorialCampaign, ShopCategories } from "../components/Editorial";

const NewArrivals = lazy(() => import("../components/NewArrivals"));
const PopularProducts = lazy(() => import("../components/PopularProducts"));
const Testimonials = lazy(() => import("../components/Testimonials"));

const Home = () => {
  return (
    <div className="store-home">
      <CustomerProfileGate />
      <Hero />
      <MobileCategories />
      <EditorialStories />
      <DeferredSection minHeight={450}><PopularProducts /></DeferredSection>
      <EditorialCampaign />
      <DeferredSection minHeight={540}><NewArrivals /></DeferredSection>
      <ShopCategories />
      <DeferredSection minHeight={520}><Testimonials /></DeferredSection>
    </div>
  );
};

export default Home;
