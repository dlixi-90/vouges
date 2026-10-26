import { lazy } from "react";
import Hero from "../components/Hero";
import DeferredSection from "../components/DeferredSection";
import { EditorialStories, EditorialCampaign, ShopCategories } from "../components/Editorial";

const NewArrivals = lazy(() => import("../components/NewArrivals"));
const PopularProducts = lazy(() => import("../components/PopularProducts"));
const Testimonials = lazy(() => import("../components/Testimonials"));

const Home = () => {
  return (
    <>
      <Hero />
      <EditorialStories />
      <DeferredSection minHeight={450}><PopularProducts /></DeferredSection>
      <EditorialCampaign />
      <DeferredSection minHeight={540}><NewArrivals /></DeferredSection>
      <ShopCategories />
      <DeferredSection minHeight={440}><Testimonials /></DeferredSection>
    </>
  );
};

export default Home;
