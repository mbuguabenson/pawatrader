import React, { useState } from 'react';
import './dangerous-site-banner.scss';

const DangerousSiteBanner: React.FC = () => {
    const [showDetails, setShowDetails] = useState(false);

    const handleBackToSafety = () => {
        // Navigate back or close the page
        window.history.back();
    };

    const handleDetails = () => {
        setShowDetails(!showDetails);
    };

    return (
        <div className='dangerous-site-banner'>
            <div className='dangerous-site-banner__content'>
                <div className='dangerous-site-banner__icon'>
                    <svg width='64' height='64' viewBox='0 0 64 64' fill='none' xmlns='http://www.w3.org/2000/svg'>
                        <circle cx='32' cy='32' r='32' fill='#EA4335' />
                        <path
                            d='M20 20L44 44'
                            stroke='white'
                            strokeWidth='4'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        />
                        <path
                            d='M44 20L20 44'
                            stroke='white'
                            strokeWidth='4'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        />
                    </svg>
                </div>

                <h1 className='dangerous-site-banner__title'>Dangerous site</h1>

                <p className='dangerous-site-banner__description'>
                    Attackers on the site you tried visiting might trick you into installing software or revealing
                    things like your passwords, phone, or credit card numbers. Chrome strongly recommends going back to
                    safety.{' '}
                    <a href='#' className='dangerous-site-banner__link' onClick={e => e.preventDefault()}>
                        Learn more about this warning
                    </a>
                </p>

                <div className='dangerous-site-banner__enhanced-protection'>
                    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
                        <path
                            d='M9 21H15M12 3C8.13 3 5 6.13 5 10C5 12.38 6.19 14.47 8 15.74V17C8 17.55 8.45 18 9 18H15C15.55 18 16 17.55 16 17V15.74C17.81 14.47 19 12.38 19 10C19 6.13 15.87 3 12 3Z'
                            stroke='#8AB4F8'
                            strokeWidth='2'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            fill='none'
                        />
                        <path d='M12 8V12M12 12V16' stroke='#8AB4F8' strokeWidth='2' strokeLinecap='round' />
                    </svg>
                    <span>Turn on enhanced protection to get Chrome's highest level of security</span>
                </div>

                <div className='dangerous-site-banner__actions'>
                    <button
                        className='dangerous-site-banner__button dangerous-site-banner__button--details'
                        onClick={handleDetails}
                    >
                        Details
                    </button>
                    <button
                        className='dangerous-site-banner__button dangerous-site-banner__button--primary'
                        onClick={handleBackToSafety}
                    >
                        Back to safety
                    </button>
                </div>

                {showDetails && (
                    <div className='dangerous-site-banner__details'>
                        <div className='dangerous-site-banner__details-content'>
                            <p>
                                Chrome has built-in safety features to protect you while you browse — like Google Safe
                                Browsing, which recently found phishing on the site you tried visiting. Phishing sites
                                pretend to be other sites to trick you.
                            </p>
                            <p>
                                Even sites that are normally safe are sometimes compromised by attackers. Let us know if
                                you think there's been a mistake and that this site doesn't pose a danger.
                            </p>
                            <p>Only visit this unsafe site if you're sure you understand the risks.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DangerousSiteBanner;
