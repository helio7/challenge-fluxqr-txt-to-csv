import logo from './logo.svg';
import './App.css';
import { useState } from 'react';

function App() {

  const [fileInput, setFileInput] = useState({});
  const [downloadLink, setDownloadLink] = useState('');

  const handleSubmit = async () => {

    const data = new FormData();
    data.append('file', fileInput);

    await fetch(`${process.env.REACT_APP_SERVER_HOST}/convert-file`, {
      method: 'POST',
      body: data,
    })
      .then(async (res) => {
        if (res.status === 200) {
          const responseJson = await res.json();
          setDownloadLink(responseJson.download_link);
        }
      })

  };

  return (
    <div className="App">

      <input type="file" onChange={(e) => {
        setFileInput(e.target.files[0]);
      }}/>

      <button onClick={handleSubmit}>
        Submit
      </button>

      {
        downloadLink !== '' ?
        <button onClick={(e) => {
          e.preventDefault();
          window.location.href=downloadLink;
        }}>
          Download file
        </button> : null
      }

    </div>
  );
}

export default App;
