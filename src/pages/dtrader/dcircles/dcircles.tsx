import React from 'react';
import IframeWrapper from '@/components/iframe-wrapper';
import './dcircles.scss';

const Dcircles = () => {
    return (
        <div className='dcircles'>
            {/* Load local copy so styling changes in /public/circles are used during development */}
            <IframeWrapper src='/circles/index.html' title='Dcircles' className='dcircles-container' />
        </div>
    );
};

export default Dcircles;
