// src/pages/LandingPage.tsx
import React from 'react';
import SearchBar from '../components/SearchBar';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion'; 

import heroIllustrationUrl from '../assets/test.gif';

interface LandingPageProps {
  onSearch: (term: string) => void;
  isLoading: boolean;
}

// Framer Motion Variants for animations
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2, 
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring', 
      stiffness: 100,
      damping: 12,
    },
  },
};

const featureItemVariants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 20,
      delay: 0.1, 
    },
  },
};


const LandingPage: React.FC<LandingPageProps> = ({ onSearch, isLoading }) => {
  const navigate = useNavigate();

  const handleLandingSearch = (termToSearch: string) => {
    const trimmedTerm = termToSearch.trim();
    if (trimmedTerm) {
      onSearch(trimmedTerm);
      navigate(`/search?term=${encodeURIComponent(trimmedTerm)}`);
    }
  };

  return (
    <motion.div
      className="landing-page-container"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="landing-bg-element landing-bg-blur-1"></div>
      <div className="landing-bg-element landing-bg-blur-2"></div>

      <motion.div className="landing-hero-section" variants={itemVariants}> 
        <div className="hero-content-wrapper"> 
          <motion.h1
            className="landing-headline"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          >
            Uncover Reddit's Pulse. <span className="headline-highlight">Instantly.</span>
          </motion.h1>
          <motion.p
            className="landing-subheadline"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
          >
            Dive deep into Reddit conversations. Track brand mentions, analyze sentiment,
            and discover emerging trends related to any topic, person, or company.
          </motion.p>
          <motion.div
            className="landing-search-wrapper"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.6, type: "spring", stiffness: 120 }}
          >
            <SearchBar
              onSearch={handleLandingSearch}
              onClearSearch={() => {}}
              isLoading={isLoading}
              isLandingPage={true}
            />
          </motion.div>
        </div>
        <motion.div
          className="hero-illustration-wrapper"
          variants={itemVariants}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }}
        >
          {/* <HeroIllustration /> */}
          <img src={heroIllustrationUrl} alt="Reddit Insights Illustration" className="hero-illustration-img" />
        </motion.div>
      </motion.div>

      <motion.div
        className="landing-features-section"
        variants={containerVariants}
        initial="hidden" 
        whileInView="visible" 
        viewport={{ once: true, amount: 0.2 }} 
      >
        <motion.div className="feature-item" variants={featureItemVariants} whileHover={{ y: -8, transition: { type: 'spring', stiffness: 300 }}}>
          <h3 className="feature-title">Comprehensive Metrics</h3>
          <p className="feature-description">
            Detailed stats: mention counts, average scores, top subreddits, sentiment distribution, and more.
          </p>
        </motion.div>

        <motion.div className="feature-item" variants={featureItemVariants} whileHover={{ y: -8, transition: { type: 'spring', stiffness: 300 }}}>
          <h3 className="feature-title">AI-Powered Insights</h3>
          <p className="feature-description">
            Leverage Google's Gemini AI for executive summaries and key theme extraction from mentions.
          </p>
        </motion.div>

        <motion.div className="feature-item" variants={featureItemVariants} whileHover={{ y: -8, transition: { type: 'spring', stiffness: 300 }}}>
          <h3 className="feature-title">Deep Dive & Track</h3>
          <p className="feature-description">
            Explore individual mentions, track specific authors, and monitor discussions over time.
          </p>
        </motion.div>
      </motion.div>
      <motion.footer className="landing-footer" style={{marginTop:'1rem'}} variants={itemVariants}>
        <p>© {new Date().getFullYear()} Reddit Mention Tracker. Powered by <a target="_blank" href="https://anurag6569201.azurewebsites.net">Anurag Singh</a>.</p>
      </motion.footer>
    </motion.div>
  );
};

export default LandingPage;