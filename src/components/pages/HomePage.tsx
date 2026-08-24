// HPI 1.7-V
import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Building2, Phone, Mail, Globe, ArrowDown, ArrowRight, X, SlidersHorizontal } from 'lucide-react';
import { BaseCrudService } from '@/integrations';
import { Businesses } from '@/entities';
import { Image } from '@/components/ui/image';
import { Input } from '@/components/ui/input';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';

export default function HomePage() {
  // --- Canonical Data Sources & Logic (Preserved) ---
  const [businesses, setBusinesses] = useState<Businesses[]>([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState<Businesses[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedBusiness, setSelectedBusiness] = useState<Businesses | null>(null);

  useEffect(() => {
    loadBusinesses();
  }, []);

  useEffect(() => {
    filterBusinesses();
  }, [searchTerm, selectedCategory, selectedCity, businesses]);

  const loadBusinesses = async () => {
    try {
      setIsLoading(true);
      const result = await BaseCrudService.getAll<Businesses>('businesses');
      setBusinesses(result.items);
      setFilteredBusinesses(result.items);
    } catch (error) {
      console.error('Failed to load businesses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterBusinesses = () => {
    let filtered = [...businesses];

    if (searchTerm) {
      filtered = filtered.filter(business =>
        business.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        business.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(business => business.category === selectedCategory);
    }

    if (selectedCity !== 'all') {
      filtered = filtered.filter(business => business.city === selectedCity);
    }

    setFilteredBusinesses(filtered);
  };

  const categories = ['all', ...Array.from(new Set(businesses.map(b => b.category).filter(Boolean)))];
  const cities = ['all', ...Array.from(new Set(businesses.map(b => b.city).filter(Boolean)))];
  // --------------------------------------------------

  // --- Motion & Parallax Setup ---
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroScrollY } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  const heroImageY = useTransform(heroScrollY, [0, 1], ['0%', '25%']);
  const heroTextY = useTransform(heroScrollY, [0, 1], ['0%', '10%']);

  const scrollToDirectory = () => {
    document.getElementById('directory')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background text-primary selection:bg-highlight selection:text-primary overflow-clip">
      <Header />

      {/* 
        HERO SECTION 
        Inspired by the provided image: Split layout, structural image left, solid highlight block right.
      */}
      <section ref={heroRef} className="relative w-full min-h-[90vh] flex flex-col lg:flex-row overflow-hidden border-b border-primary/10">
        
        {/* Left: Structural Image with Parallax */}
        <div className="w-full lg:w-[60%] relative h-[50vh] lg:h-auto overflow-hidden bg-primary">
          <motion.div style={{ y: heroImageY }} className="absolute inset-0 w-full h-[120%] -top-[10%]">
            <Image
              src="https://static.wixstatic.com/media/1f5d89_ce6178d183664ee6800daf8813ba6bb8~mv2.png?originWidth=1920&originHeight=1024"
              alt="Tri-state area business landscape"
              className="w-full h-full object-cover grayscale contrast-125 opacity-90 mix-blend-luminosity"
              width={1920}
            />
            {/* Subtle overlay for texture */}
            <div className="absolute inset-0 bg-primary/10 mix-blend-multiply pointer-events-none" />
          </motion.div>
        </div>

        {/* Right: Highlight Block with Typography */}
        <div className="w-full lg:w-[40%] bg-highlight relative flex flex-col justify-center p-10 lg:p-20 xl:p-24 z-10">
          <motion.div style={{ y: heroTextY }} className="max-w-xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <h1 className="font-heading text-5xl lg:text-6xl xl:text-7xl leading-[1.1] tracking-tight text-primary mb-6">
                Tri-State<br />
                Business<br />
                Directory
              </h1>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="font-paragraph text-lg lg:text-xl text-primary/80 mb-16 max-w-md">
                Discover, connect, and grow with the most comprehensive network of verified local enterprises.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.4 }}
              className="flex items-center justify-between border-t border-primary/20 pt-8"
            >
              <button 
                onClick={scrollToDirectory}
                className="group flex items-center gap-4 font-heading text-sm tracking-widest uppercase hover:opacity-70 transition-opacity"
              >
                <span className="flex items-center justify-center w-10 h-10 border border-primary rounded-full group-hover:bg-primary group-hover:text-highlight transition-colors">
                  <ArrowDown className="w-4 h-4" />
                </span>
                Explore Directory
              </button>
              
              {/* Decorative Icon referencing the inspiration image's line art */}
              <Building2 className="w-12 h-12 text-primary/20 stroke-[1]" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* 
        DIRECTORY SECTION 
        Modular, grid-based, sticky sidebar for filters.
      */}
      <section id="directory" className="w-full max-w-[120rem] mx-auto px-6 lg:px-12 py-24 lg:py-32">
        
        {/* Section Header */}
        <div className="mb-16 lg:mb-24 flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-primary/10 pb-8">
          <div>
            <h2 className="font-heading text-3xl lg:text-4xl text-primary mb-4">Verified Listings</h2>
            <p className="font-paragraph text-primary/60 max-w-xl">
              Filter through our curated database to find exactly what you need in your area.
            </p>
          </div>
          <div className="font-heading text-sm tracking-widest uppercase text-primary/40">
            {filteredBusinesses.length} Results Found
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
          
          {/* STICKY SIDEBAR: Filters */}
          <div className="lg:col-span-3">
            <div className="sticky top-32 space-y-10">
              
              <div className="flex items-center gap-3 font-heading text-lg border-b border-primary/10 pb-4">
                <SlidersHorizontal className="w-5 h-5" />
                Filters
              </div>

              {/* Search */}
              <div className="space-y-3">
                <label className="font-heading text-xs tracking-widest uppercase text-primary/60 block">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-primary/40 w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="Name or keyword..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 h-12 text-base border-0 border-b border-primary/20 bg-transparent rounded-none focus-visible:ring-0 focus-visible:border-primary px-0 placeholder:text-primary/30"
                  />
                </div>
              </div>

              {/* Category Filter */}
              <div className="space-y-3">
                <label className="font-heading text-xs tracking-widest uppercase text-primary/60 block">
                  Category
                </label>
                <div className="relative">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full h-12 appearance-none bg-transparent border-0 border-b border-primary/20 text-primary font-paragraph text-base focus:ring-0 focus:border-primary cursor-pointer rounded-none"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat} className="bg-background">
                        {cat === 'all' ? 'All Categories' : cat}
                      </option>
                    ))}
                  </select>
                  <ArrowDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40 pointer-events-none" />
                </div>
              </div>

              {/* City Filter */}
              <div className="space-y-3">
                <label className="font-heading text-xs tracking-widest uppercase text-primary/60 block">
                  Location
                </label>
                <div className="relative">
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full h-12 appearance-none bg-transparent border-0 border-b border-primary/20 text-primary font-paragraph text-base focus:ring-0 focus:border-primary cursor-pointer rounded-none"
                  >
                    {cities.map(city => (
                      <option key={city} value={city} className="bg-background">
                        {city === 'all' ? 'All Cities' : city}
                      </option>
                    ))}
                  </select>
                  <ArrowDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40 pointer-events-none" />
                </div>
              </div>

            </div>
          </div>

          {/* MAIN CONTENT: Business Grid */}
          <div className="lg:col-span-9 min-h-[60vh]">
            {isLoading ? (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-[300px] bg-primary/5 animate-pulse border border-primary/10" />
                ))}
              </div>
            ) : filteredBusinesses.length > 0 ? (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredBusinesses.map((business, index) => (
                  <motion.div
                    key={business._id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.5, delay: (index % 6) * 0.1 }}
                    onClick={() => setSelectedBusiness(business)}
                    className="group relative bg-background border border-primary/15 p-8 cursor-pointer hover:border-primary transition-colors duration-300 flex flex-col h-full"
                  >
                    {/* Top Accent Line */}
                    <div className="absolute top-0 left-0 w-0 h-[2px] bg-highlight group-hover:w-full transition-all duration-500 ease-out" />

                    <div className="flex-grow">
                      {business.logo ? (
                        <div className="mb-8 h-12 flex items-center justify-start opacity-80 group-hover:opacity-100 transition-opacity">
                          <Image
                            src={business.logo}
                            alt={business.businessName || 'Business logo'}
                            className="max-h-12 w-auto object-contain grayscale group-hover:grayscale-0 transition-all duration-500"
                            width={200}
                          />
                        </div>
                      ) : (
                        <div className="mb-8 h-12 flex items-center justify-start">
                          <Building2 className="w-8 h-8 text-primary/20 stroke-[1]" />
                        </div>
                      )}
                      
                      {business.category && (
                        <div className="font-heading text-[10px] tracking-widest uppercase text-primary/50 mb-3">
                          {business.category}
                        </div>
                      )}

                      <h3 className="font-heading text-xl text-primary mb-4 leading-tight group-hover:text-primary/80 transition-colors">
                        {business.businessName}
                      </h3>
                      
                      {business.description && (
                        <p className="font-paragraph text-sm text-primary/70 mb-6 line-clamp-3 leading-relaxed">
                          {business.description}
                        </p>
                      )}
                    </div>
                    
                    <div className="pt-6 border-t border-primary/10 mt-auto flex items-center justify-between">
                      {business.city && (
                        <div className="flex items-center gap-2 text-primary/60 text-xs font-heading uppercase tracking-wider">
                          <MapPin className="w-3 h-3" />
                          <span>{business.city}</span>
                        </div>
                      )}
                      <ArrowRight className="w-4 h-4 text-primary/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full py-32 text-center border border-primary/10 border-dashed"
              >
                <Search className="w-12 h-12 text-primary/20 mb-6 stroke-[1]" />
                <h3 className="font-heading text-2xl text-primary mb-2">No matches found</h3>
                <p className="font-paragraph text-primary/60 max-w-md">
                  We couldn't find any businesses matching your current filters. Try adjusting your search criteria.
                </p>
                <button 
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategory('all');
                    setSelectedCity('all');
                  }}
                  className="mt-8 font-heading text-sm tracking-widest uppercase border-b border-primary pb-1 hover:text-primary/60 hover:border-primary/60 transition-colors"
                >
                  Clear Filters
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* 
        MODAL: Business Details 
        Clean, architectural overlay.
      */}
      <AnimatePresence>
        {selectedBusiness && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-12">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 bg-primary/90 backdrop-blur-sm"
              onClick={() => setSelectedBusiness(null)}
            />
            
            {/* Modal Content */}
            <motion.div 
              initial={{ opacity: 0, y: 40, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-4xl bg-background max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col md:flex-row"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedBusiness(null)}
                className="absolute top-6 right-6 z-10 p-2 bg-background/80 backdrop-blur hover:bg-primary hover:text-background transition-colors rounded-full"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Left Column: Visuals & Core Info */}
              <div className="w-full md:w-2/5 bg-highlight p-8 lg:p-12 flex flex-col">
                {selectedBusiness.logo ? (
                  <div className="mb-12 h-24 bg-background/50 p-4 flex items-center justify-center">
                    <Image
                      src={selectedBusiness.logo}
                      alt={selectedBusiness.businessName || 'Business logo'}
                      className="max-h-full w-auto object-contain mix-blend-multiply"
                      width={300}
                    />
                  </div>
                ) : (
                  <div className="mb-12 h-24 bg-primary/5 flex items-center justify-center">
                    <Building2 className="w-12 h-12 text-primary/20 stroke-[1]" />
                  </div>
                )}

                <div className="mt-auto">
                  {selectedBusiness.category && (
                    <div className="font-heading text-xs tracking-widest uppercase text-primary/60 mb-4">
                      {selectedBusiness.category}
                    </div>
                  )}
                  <h2 className="font-heading text-3xl lg:text-4xl text-primary leading-tight mb-6">
                    {selectedBusiness.businessName}
                  </h2>
                  
                  {selectedBusiness.website && (
                    <a 
                      href={selectedBusiness.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 font-heading text-sm tracking-widest uppercase border-b border-primary pb-1 hover:opacity-60 transition-opacity"
                    >
                      <Globe className="w-4 h-4" />
                      Visit Website
                    </a>
                  )}
                </div>
              </div>

              {/* Right Column: Details */}
              <div className="w-full md:w-3/5 p-8 lg:p-12 bg-background">
                
                {selectedBusiness.description && (
                  <div className="mb-12">
                    <h3 className="font-heading text-sm tracking-widest uppercase text-primary/40 mb-6 flex items-center gap-4">
                      About <span className="h-[1px] flex-grow bg-primary/10"></span>
                    </h3>
                    <p className="font-paragraph text-base text-primary/80 leading-relaxed">
                      {selectedBusiness.description}
                    </p>
                  </div>
                )}

                <div>
                  <h3 className="font-heading text-sm tracking-widest uppercase text-primary/40 mb-6 flex items-center gap-4">
                    Contact <span className="h-[1px] flex-grow bg-primary/10"></span>
                  </h3>
                  
                  <div className="space-y-6">
                    {selectedBusiness.address && (
                      <div className="flex items-start gap-4 group">
                        <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center flex-shrink-0 group-hover:bg-highlight transition-colors">
                          <MapPin className="w-4 h-4 text-primary" />
                        </div>
                        <div className="font-paragraph text-base text-primary pt-2">
                          <div className="mb-1">{selectedBusiness.address}</div>
                          <div className="text-primary/60">
                            {selectedBusiness.city}, {selectedBusiness.state} {selectedBusiness.zipCode}
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedBusiness.phoneNumber && (
                      <div className="flex items-center gap-4 group">
                        <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center flex-shrink-0 group-hover:bg-highlight transition-colors">
                          <Phone className="w-4 h-4 text-primary" />
                        </div>
                        <a 
                          href={`tel:${selectedBusiness.phoneNumber}`}
                          className="font-paragraph text-base text-primary hover:text-primary/60 transition-colors"
                        >
                          {selectedBusiness.phoneNumber}
                        </a>
                      </div>
                    )}

                    {selectedBusiness.email && (
                      <div className="flex items-center gap-4 group">
                        <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center flex-shrink-0 group-hover:bg-highlight transition-colors">
                          <Mail className="w-4 h-4 text-primary" />
                        </div>
                        <a 
                          href={`mailto:${selectedBusiness.email}`}
                          className="font-paragraph text-base text-primary hover:text-primary/60 transition-colors break-all"
                        >
                          {selectedBusiness.email}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}