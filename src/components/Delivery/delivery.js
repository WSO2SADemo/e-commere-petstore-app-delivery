import React, { useEffect } from 'react';
import { Button, Col, Container, Form, FormLabel, Row, Table } from 'react-bootstrap';
import { InputNumber, InputGroup } from 'rsuite';
import '../../App.js';
import '../../index.css';
import { useCartContext } from '../context/context';
import { default as authConfig } from "../../config.json";
import { useAuthContext } from '../context/authContext';
import { manualSignIn, manualGetToken, manualSignOut } from '../Authenticator/Auth.js';
import { useState } from 'react';
import { parseJwt } from '../util';
import axios, { isCancel, AxiosError } from 'axios';
import '../css/popup.css';
import './inputnumber.less';

export default function Delivery() {

    const { cart, uptateItemQty } = useCartContext();
    const { handleLogin, handleLogout, handleToken, handleIDToken, isAuthenticated, token, idToken } = useAuthContext();
    const [deliveryStatuses, setDeliveryStatuses] = useState([]);
    const [code, setCode] = useState("");
    const [catalogUpdateToggle, setCatalogUpdateToggle] = useState(false);
    const [scopeURI, setScopeURI] = useState(false);
    const [scopeAdmin, setScopeAdmin] = useState(false);
    const [scopeCustomer, setScopeCustomer] = useState(false);
    const [gatewayURL, setGatewayURL] = useState();
    const [popupContent, setPopupContent] = useState("");
    const [isPopupVisible, setPopupVisible] = useState(false);
    const [isLogoutState, setIsLogoutState] = useState(false);

    var codeResponse = "";
    var email;

    const handleOkClick = () => {
        console.log("OK button clicked 2!");
        setPopupVisible(false);
        if (isLogoutState) {
            manualSignOut();
        }
    }

    useEffect(() => {
        console.log("[isPopupVisible]: " + isPopupVisible);
    }, [isPopupVisible]);


    const assignVariables = () => {
        if (authConfig.IS.enabled == true) {
            setScopeURI(authConfig.IS.scopeURI);
            setScopeAdmin(authConfig.IS.scopeAdmin);
            setScopeCustomer(authConfig.IS.scopeCustomer);
            setGatewayURL(authConfig.IS.endpointURL);
            if (authConfig.IS.tenantDomain != null) {
                setGatewayURL(authConfig.IS.endpointURL.replace("{{domain_name}}", authConfig.IS.tenantDomain));
            }
        } else {
            setScopeURI(authConfig.Auth0.scopeURI);
            setScopeAdmin(authConfig.Auth0.scopeAdmin);
            setScopeCustomer(authConfig.Auth0.scopeCustomer);
            setGatewayURL(authConfig.Auth0.endpointURL);
        }
    }

    useEffect(() => {
        console.log("-- Catalog useEffect[] --");
        var signInRedirectURL;
        if (authConfig.IS.enabled == true) {
            signInRedirectURL = authConfig.IS.signInRedirectURL;
        } else {
            signInRedirectURL = authConfig.Auth0.signInRedirectURL;
        }
        console.log("In Catalog.js, isAuthenticated: " + JSON.stringify(isAuthenticated));
        const redirectUrl = window.location.href;
        console.log("In catalog useEffect: redirectUrl: " + redirectUrl);
        codeResponse = new URL(redirectUrl).searchParams.get("code");
        console.log("CODE: " + codeResponse);
        if (codeResponse != null || code != "") {
            handleLogin();
            setCode(codeResponse);
            console.log("Received code: " + codeResponse);
            console.log("Current token: " + token);
            if (token == null || token == "") {
                manualGetToken(codeResponse, signInRedirectURL)
                    .then((tokenResponse) => {
                        console.log("------------ token in manualGetToken() -------------- ");
                        console.log(tokenResponse);
                        if (authConfig.IS.enabled == true) {
                            handleToken(tokenResponse.access_token);
                            handleIDToken(tokenResponse.id_token);
                        } else {
                            handleToken(tokenResponse.id_token);
                            handleIDToken(tokenResponse.id_token);
                        }
                    })
                    .catch((error) => {
                        // throw new Error(error);
                        setPopupVisible(true);
                        setIsLogoutState(true);
                        setPopupContent(error.response.data.description);
                    });
            }
        }
    }, []);

    useEffect(() => {
        console.log("-- Catalog useEffect[token, catalogUpdateToggle] --");
        if (token != null) {
            assignVariables();
            document.title = "Customer | My Cart";

        }
    }, [token, catalogUpdateToggle]);

    useEffect(() => {
        console.log("-- [gatewayURL] use Effect gatewayURL: " + gatewayURL);
        getDeliveryStatus();
    }, [gatewayURL]);

    // State to keep track of the number of items in the cart
    const [value, setValue] = React.useState(1);

    const getDeliveryStatus = (newid) => {
        if (idToken) {
            var decodedToken = parseJwt(idToken);
            email = decodedToken["email"];
            console.log("-- getDeliveryStatus() -- for " + email);
            if (token && token.length != 0) {
                var decodedToken = parseJwt(idToken);
                var scopes = decodedToken[scopeURI];
                var department = decodedToken["department"];
                if (gatewayURL != null) {
                    console.log("-- getDeliveryStatus(): " + gatewayURL);
                    const url = gatewayURL + '/sellerDispatchItems?sellerId=' + department;
                    const headers = {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json',
                    };
                    const fetchDeliveryStatuses = async () => {
                        console.log("-- getDeliveryStatus() url : " + url);
                        const result = await axios.get(url, { headers });
                        return result.data;
                    };
                    const fetchData = async () => {
                        const deliveryData = await fetchDeliveryStatuses();
                        console.log(deliveryData);
                        console.log(deliveryData.length);
                        setDeliveryStatuses(deliveryData);
                        if (deliveryData.length < 1) {
                            console.log("-- deliveryData.length() url : " + deliveryData.length);
                            setPopupVisible(true);
                            setIsLogoutState(false);
                            setPopupContent("No items available to ship from your department !!");
                        }
                    };
                    fetchData();
                }
            }
        }

    }
    
    const dispatchDelivery = (id) => {
        console.log("Id numbers of the items to be dispatched: " + id);
        var idaArray = id.split("|");
        var status = false;
        if (token && token.length != 0) {
            const dispatchButton = document.getElementById(id + "_dispatch");
            if (dispatchButton != null) {
                status = true;
            }
            const dispatchStatus = {
                "itemId": parseInt(idaArray[1]),
                "purchaseId": parseInt(idaArray[0]),
                "status": status
            };
            var decodedToken = parseJwt(idToken);
            var scopes = decodedToken[scopeURI];
            console.log(scopes);
            if (scopes.includes(scopeAdmin)) {
                const url = gatewayURL + '/updateDeliveryStatus';
                const headers = {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                    // 'Access-Control-Allow-Origin': '*'
                };
                try {
                    const purchaseConfirm = async () => {
                        console.log("lalala");
                        const result = await axios.post(url, dispatchStatus, { headers });
                        console.log(result.data);
                        const dispatchButton = document.getElementById(id + "_dispatch");
                        if (dispatchButton != null) {
                            dispatchButton.innerHTML = "Dispatched";
                            dispatchButton.id = id + "_dispatched";
                            dispatchButton.variant = "success"
                        } else {
                            dispatchButton.innerHTML = "Dispatch";
                            dispatchButton.id = id + "_dispatch";
                            dispatchButton.variant = "danger"
                        }
                        return result.data;
                    };
                    purchaseConfirm();
                    // Work with the response...
                } catch (err) {
                    // Handle error
                    console.log(err.response.data.description);
                    setPopupVisible(true);
                    setIsLogoutState(false);
                    setPopupContent(err.response.data.description);
                }

            } else {
                console.log("CUSTOMER is not in the scope list")
                setPopupVisible(true);
                setIsLogoutState(false);
                setPopupContent(scopeAdmin + " is not in the '" + scopeURI + "' in IDToken. Available values: " + scopes);
            }
        }
    };




    // Number of items in the cart
    let numItems = cart.reduce((acc, curr) => acc + curr.qty, 0);
    let cartPrice = cart.reduce((acc, curr) => acc + curr.qty * curr.Price, 0);
    // onClick={() => placeOrder()}
    return (
        <>
            <Container className="mt-5">
                <Row>
                    <Table bordered hover>
                        <thead>
                            <tr>
                                <th scope="col" width="50px">OrderId</th>
                                <th scope="col" width="100px">Total</th>
                                <th scope="col">Total</th>
                            </tr>
                            {deliveryStatuses.map(cat => (
                                <tr className="align-middle" key={cat.id}>
                                    <td>{cat.id}</td>
                                    <td>{cat.total}</td>
                                    <tr>
                                        <th scope="col" width="100px">name</th>
                                        <th scope="col" width="100px">id</th>
                                        <th scope="col" width="100px">quantity</th>
                                        <th scope="col" width="100px">unit price</th>
                                        <th scope="col" width="100px">total</th>
                                        <th scope="col" width="100px">delivered</th>
                                    </tr>
                                    {cat.purchaseItems.map(purchaseItem => (
                                        <tr className="align-middle">
                                            <td>{purchaseItem.name}</td>
                                            <td>{purchaseItem.itemId}</td>
                                            <td>{purchaseItem.quantity}</td>
                                            <td>{purchaseItem.unitPrice}</td>
                                            <td>{purchaseItem.total}</td>
                                            {!purchaseItem.delivered == 1 ?
                                                <td><Button id={cat.id + "|" + purchaseItem.itemId + "|" + "_dispatch"} variant="danger" onClick={() => dispatchDelivery(cat.id + "|" + purchaseItem.itemId + "|")} size="sm">Dispatch</Button></td> :
                                                <td><Button id={cat.id + "|" + purchaseItem.itemId + "|" + "_dispatched"} variant="success" onClick={() => dispatchDelivery(cat.id + "|" + purchaseItem.itemId + "|")} size="sm" >Dispatched</Button></td>
                                            }
                                        </tr>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                    </Table>
                </Row>
                {isPopupVisible && (
                    <div className="popup">
                        <div className="popup-content">
                            <h2>Error</h2>
                            <p>{popupContent}</p>
                            <button onClick={handleOkClick} className="popup-button">OK</button>
                            {/* <button onClick={() => setPopupVisible(false)} className="popup-button">Cancel</button> */}
                        </div>
                    </div>
                )}

            </Container>
        </>
    );
}

