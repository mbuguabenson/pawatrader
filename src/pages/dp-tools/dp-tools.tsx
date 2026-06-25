import React from 'react';
import IframeWrapper from '@/components/iframe-wrapper';

const DpTools: React.FC = () => (
    <IframeWrapper src='https://bot-analysis-tool-belex.web.app/' title='DP Tools' className='dp-tools-container' />
);

export default DpTools;
