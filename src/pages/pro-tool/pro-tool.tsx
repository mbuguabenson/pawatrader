import React from 'react';
import './pro-tool.scss';

const ProTool = () => {
    return (
        <div className='pro-tool'>
            <div className='pro-tool__container'>
                <iframe
                    src='/pro-tools/index.html'
                    title='Pro Tools'
                    className='pro-tool__iframe'
                    frameBorder='0'
                    style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        minHeight: '600px',
                    }}
                />
            </div>
        </div>
    );
};

export default ProTool;
