import React, {useState} from "react";
import {useWialon} from "../../context/WialonProvider";

const WialonUnitInfo = () => {
  const {units, getUnitById, loading, error} = useWialon();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUnit, setSelectedUnit] = useState(null);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleSelectUnit = () => {
    const unitId = parseInt(searchTerm);
    const unit = getUnitById(unitId);
    if (unit) {
      setSelectedUnit(formatUnitDetails(unit));
    } else {
      setSelectedUnit("Unit not found.");
    }
  };

  const formatUnitDetails = (unit) => {
    let details = `<b>${unit.getName()}</b>`;
    const icon = unit.getIconUrl(32);
    if (icon) {
      details = `<img src="${icon}" alt="unit icon" /> ${details}`;
    }

    const pos = unit.getPosition();
    if (pos) {
      const time = window.wialon.util.DateTime.formatTime(pos.t);
      details += `<br/><b>Last message</b>: ${time}<br/><b>Position</b>: ${pos.x}, ${pos.y}<br/><b>Speed</b>: ${pos.s}`;
      window.wialon.util.Gis.getLocations([{lon: pos.x, lat: pos.y}], (code, address) => {
        if (!code) {
          setSelectedUnit(`${details}<br/><b>Location</b>: ${address}`);
        }
      });
    } else {
      details += "<br/><b>Location</b>: Unknown";
    }
    return details;
  };

  const filteredUnits = units.filter(
    (unit) =>
      unit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      unit.id.toString().includes(searchTerm)
  );

  if (loading) return <div>Cargando unidades...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Wialon Unit Information</h1>

      <div>
        <h3>Search and Select a Unit:</h3>
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Search units by name or ID"
          list="units"
        />
        <datalist id="units">
          {filteredUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name} (ID: {unit.id})
            </option>
          ))}
        </datalist>
        <button onClick={handleSelectUnit} value={searchTerm}>
          Select
        </button>
      </div>

      {selectedUnit && <div dangerouslySetInnerHTML={{__html: selectedUnit}} />}
    </div>
  );
};

export default WialonUnitInfo;
