import { lazy } from "react";
import Hero from "../components/Hero";
import DeferredSection from "../components/DeferredSection";
import CustomerProfileGate from "../components/CustomerProfileGate";
import { EditorialStories, EditorialCampaign, ShopCategories } from "../components/Editorial";
import Testimonials from "../components/Testimonials";

const NewArrivals = lazy(() => import("../components/NewArrivals"));
const PopularProducts = lazy(() => import("../components/PopularProducts"));

const Home = () => {
  return (
    <>
      <CustomerProfileGate />
      <Hero />
      <EditorialStories />
      <DeferredSection minHeight={450}><PopularProducts /></DeferredSection>
      <EditorialCampaign />
      <DeferredSection minHeight={540}><NewArrivals /></DeferredSection>
      <ShopCategories />
      <Testimonials />
    </>
  );
};

export default Home;
