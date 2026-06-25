import React from 'react';
import IframeWrapper from '@/components/iframe-wrapper';

const AnalysisTool: React.FC = () => {
    return (
        <IframeWrapper
            src='https://api-binarytool-site.vercel.app/'
            title='Analysis Tool'
            className='analysis-tool-container'
        />
    );
};

export default AnalysisTool;
